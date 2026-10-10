/**
 * Explicit-consent backup queue, isolated by verified account UUID.
 * Queuing, sign-in and local edits NEVER upload automatically.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { workspaceDatabaseName } from "../../db/scopedWorkspace";
import { activeWorkspaceOwner } from "../../db/workspaceRouter";
import { validateLegacyBackup, type LegacyBackup } from "../../db/legacySnapshot";
import { inspectManualCloudBackup, uploadManualCloudBackup } from "./manualBackup";

export type BackupQueueStatus = "pending" | "failed" | "synced";
export type BackupQueueJob = {
  id: "pending";
  userId: string;
  status: BackupQueueStatus;
  checksum: string;
  backup: LegacyBackup | null;
  expectedRemoteChecksum: string | null;
  attempts: number;
  retryAfter: number;
  leaseUntil: number;
  leaseToken: string | null;
  updatedAt: number;
  errorCode: "CONFLICT" | "AUTH" | "NETWORK" | "OTHER" | null;
};
const LEASE_MS = 90_000;
function ownerGuard(userId: string): void {
  const owner = activeWorkspaceOwner();
  if (owner?.kind !== "account" || owner.userId !== userId) {
    throw new Error("Wrong active backup workspace");
  }
  workspaceDatabaseName({kind:"account",userId});
}
export function backupQueueDbName(userId: string): string {
  return "ChunkDiaryBackupQueue-" + workspaceDatabaseName({kind:"account",userId});
}
async function dbFor(userId: string, factory: IDBFactory): Promise<IDBDatabase> {
  ownerGuard(userId);
  return new Promise((resolve,reject) => {
    const r=factory.open(backupQueueDbName(userId),1);
    r.onupgradeneeded=() => r.result.createObjectStore("jobs",{keyPath:"id"});
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
async function withDb<T>(userId:string,factory:IDBFactory,task:(db:IDBDatabase)=>Promise<T>):Promise<T>{
  const db=await dbFor(userId,factory);
  try {return await task(db);}finally{db.close();}
}
function read(db:IDBDatabase):Promise<BackupQueueJob|null>{
  return new Promise((resolve,reject)=>{
    const r=db.transaction("jobs","readonly").objectStore("jobs").get("pending");
    r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);
  });
}
function update(db:IDBDatabase,fn:(current:BackupQueueJob|null)=>BackupQueueJob|null):Promise<BackupQueueJob|null>{
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("jobs","readwrite"), st=tx.objectStore("jobs");
    const req=st.get("pending");let next:BackupQueueJob|null=null;
    req.onsuccess=()=>{try{
      next=fn(req.result??null);
      if(next)st.put(next);else st.delete("pending");
    }catch(e){reject(e);tx.abort();}};
    tx.oncomplete=()=>resolve(next);
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export async function inspectBackupQueue(userId:string,factory:IDBFactory=indexedDB){
  return withDb(userId,factory,read);
}
export async function enqueueBackup(
  userId:string, backup:LegacyBackup, expectedRemoteChecksum:string|null,
  options:{confirmed:true;indexedDB?:IDBFactory;now?:number},
):Promise<BackupQueueJob>{
  if(options?.confirmed!==true)throw new Error("Explicit consent required");
  ownerGuard(userId);
  const valid=await validateLegacyBackup(backup);
  const now=options.now??Date.now();
  return withDb(userId,options.indexedDB??indexedDB,async db=>{
    const result=await update(db,current=>{
      if(current&&current.status!=="synced"){
        if(current.checksum===valid.checksum&&current.expectedRemoteChecksum===expectedRemoteChecksum)return current;
        throw new Error("Unresolved backup already queued");
      }
      return {id:"pending",userId,status:"pending",backup:valid,
        checksum:valid.checksum,expectedRemoteChecksum,attempts:0,
        retryAfter:0,leaseUntil:0,leaseToken:null,updatedAt:now,errorCode:null};
    });
    if(!result)throw new Error("Queue write failed");
    return result;
  });
}
export async function sendQueuedBackup(
  client:SupabaseClient,userId:string,
  options:{indexedDB?:IDBFactory;now?:number;signal?:AbortSignal}={},
):Promise<{status:BackupQueueStatus|"busy"|"not_due"|"none";errorCode?:BackupQueueJob["errorCode"]}>{
  ownerGuard(userId);
  const factory=options.indexedDB??indexedDB,now=options.now??Date.now();
  const token=crypto.randomUUID();
  const job=await withDb(userId,factory,db=>update(db,current=>{
    if(!current||current.status==="synced")return current;
    if(current.userId!==userId)throw new Error("Queue owner mismatch");
    if(current.leaseUntil>now||current.retryAfter>now)return current;
    return {...current,leaseUntil:now+LEASE_MS,leaseToken:token,
      attempts:current.attempts+1,updatedAt:now};
  }));
  if(!job||job.status==="synced")return {status:"none"};
  if(job.leaseToken!==token)return {status:job.retryAfter>now?"not_due":"busy"};
  try{
    if(!job.backup||options.signal?.aborted)throw new Error("Backup aborted");
    await uploadManualCloudBackup(client,userId,job.backup,{
      confirmed:true,expectedRemoteChecksum:job.expectedRemoteChecksum,signal:options.signal,
    });
    if(options.signal?.aborted)throw new Error("Backup aborted");
    ownerGuard(userId);
    await withDb(userId,factory,db=>update(db,current=>
      current?.leaseToken===token?
        {...current,status:"synced",backup:null,leaseToken:null,leaseUntil:0,
          retryAfter:0,errorCode:null,updatedAt:options.now??Date.now()}:current));
    return {status:"synced"};
  }catch(error){
    // A lost response after a successful CAS may look like a failed request.
    // Read back only the owner's authenticated cloud snapshot. If it has
    // exactly the same checksum, mark this queue entry synced rather than
    // repeatedly attempting a new write. This makes retries idempotent.
    if (!options.signal?.aborted) {
      try {
        ownerGuard(userId);
        const remote = await inspectManualCloudBackup(client, userId);
        if (remote.receipt.checksum === job.checksum) {
          ownerGuard(userId);
          await withDb(userId,factory,db=>update(db,current=>
            current?.leaseToken===token?
              {...current,status:"synced",backup:null,leaseToken:null,leaseUntil:0,
                retryAfter:0,errorCode:null,updatedAt:options.now??Date.now()}:current));
          return {status:"synced"};
        }
      } catch { /* If offline or foreign owner, preserve the queued snapshot. */ }
    }
    const msg=error instanceof Error?error.message:"";
    const errorCode=msg.includes("CONFLICT")?"CONFLICT":
      /Auth|ownership|account|workspace/i.test(msg)?"AUTH":
      /fetch|network|offline|503|abort|timeout/i.test(msg)?"NETWORK":"OTHER";
    try{
      ownerGuard(userId);
      await withDb(userId,factory,db=>update(db,current=>
        current?.leaseToken===token?
          {...current,status:"failed",leaseToken:null,leaseUntil:0,errorCode,
            retryAfter:(options.now??Date.now())+Math.min(600_000,5000*2**Math.min(7,current.attempts-1)),
            updatedAt:options.now??Date.now()}:current));
    }catch{/* Never touch the previous owner's queue after a switch. */}
    return {status:"failed",errorCode};
  }
}
export async function discardQueuedBackup(
  userId:string, options:{confirmed:true;indexedDB?:IDBFactory;now?:number},
):Promise<void>{
  if(options?.confirmed!==true)throw new Error("Explicit discard required");
  const now=options.now??Date.now();
  await withDb(userId,options.indexedDB??indexedDB,async db=>{
    await update(db,current=>{
      if(current?.leaseUntil&&current.leaseUntil>now)throw new Error("Upload in progress");
      return null;
    });
  });
}
