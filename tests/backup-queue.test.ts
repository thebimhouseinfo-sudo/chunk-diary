import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory as FakeFactory } from "fake-indexeddb";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chooseAccountWorkspace, resetWorkspaceRuntime } from "../src/db/workspaceRouter.ts";
import { saveDiary } from "../src/db/indexedDb.ts";
import { createManualWorkspaceBackup } from "../src/services/supabase/manualBackup.ts";
import {
  backupQueueDbName, enqueueBackup, inspectBackupQueue, sendQueuedBackup, discardQueuedBackup,
} from "../src/services/supabase/backupQueue.ts";

const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const auth=(id:string)=>async()=>({id,isAnonymous:false});
const storage=()=>{const m=new Map<string,string>();return{
  getItem:(k:string)=>m.get(k)??null,
  setItem:(k:string,v:string)=>{m.set(k,v);},
  removeItem:(k:string)=>{m.delete(k);}
};};
async function fixture(){
  const factory=new FakeFactory() as unknown as IDBFactory;
  (globalThis as {indexedDB:IDBFactory}).indexedDB=factory;
  const store=storage();
  (globalThis as {localStorage:Storage}).localStorage=store as unknown as Storage;
  resetWorkspaceRuntime();
  await chooseAccountWorkspace(A,auth(A),store);
  await saveDiary({id:"same-id",title:"Private",content:"Synthetic diary only",createdAt:new Date().toISOString()});
  const backup=await createManualWorkspaceBackup(A);
  return {factory,store,backup};
}
function mockClient(mode:"pass"|"network"|"conflict", during?:()=>Promise<void>){
  let calls=0;
  const client={
    auth:{getUser:async()=>({data:{user:{id:A,is_anonymous:false}},error:null})},
    rpc:async(_name:string,args:{p_payload:{backup:{checksum:string}}})=>{
      calls++;
      await during?.();
      if(mode==="network")throw new Error("fetch failed offline");
      return {data:mode==="conflict"
        ?{allowed:false,reason:"CONFLICT"}
        :{allowed:true,checksum:args.p_payload.backup.checksum},error:null};
    }
  } as unknown as SupabaseClient;
  return {client,get calls(){return calls;}};
}

test("M6 queue: owner-isolated persist, explicit consent, no implicit upload",async()=>{
  const {factory,store,backup}=await fixture();
  await assert.rejects(enqueueBackup(A,backup,null,{} as never),/consent/);
  const mock=mockClient("pass");
  await enqueueBackup(A,backup,null,{confirmed:true,indexedDB:factory,now:1000});
  const state=await inspectBackupQueue(A,factory);
  assert.equal(state?.status,"pending");
  assert.equal(state?.checksum,backup.checksum);
  assert.equal(mock.calls,0,"queue should never upload automatically");
  await assert.rejects(enqueueBackup(A,{...backup,checksum:"fake"},null,
    {confirmed:true,indexedDB:factory}),/checksum mismatch/);
  assert.match(backupQueueDbName(A),/aaaaaaaa/);
  await chooseAccountWorkspace(B,auth(B),store);
  assert.match(backupQueueDbName(B),/bbbbbbbb/);
  await assert.rejects(inspectBackupQueue(A,factory),/Wrong active/);
  assert.equal(await inspectBackupQueue(B,factory),null);
  await chooseAccountWorkspace(A,auth(A),store);
  assert.equal((await inspectBackupQueue(A,factory))?.checksum,backup.checksum);
  await assert.rejects(discardQueuedBackup(A,{} as never),/discard/);
  await discardQueuedBackup(A,{confirmed:true,indexedDB:factory,now:1001});
  assert.equal(await inspectBackupQueue(A,factory),null);
});

test("M6 queue: offline failure is durable, backoff prevents immediate duplicate, explicit retry succeeds",async()=>{
  const {factory,backup}=await fixture();
  await enqueueBackup(A,backup,null,{confirmed:true,indexedDB:factory,now:1000});
  const network=mockClient("network");
  assert.deepEqual(await sendQueuedBackup(network.client,A,{indexedDB:factory,now:2000}),
    {status:"failed",errorCode:"NETWORK"});
  const state=await inspectBackupQueue(A,factory);
  assert.equal(state?.attempts,1);
  assert.equal(state?.status,"failed");
  assert.equal(state?.retryAfter,7000);
  const pass=mockClient("pass");
  assert.equal((await sendQueuedBackup(pass.client,A,{indexedDB:factory,now:3000})).status,"not_due");
  assert.equal(pass.calls,0,"no paid retry during backoff");
  assert.equal((await sendQueuedBackup(pass.client,A,{indexedDB:factory,now:7001})).status,"synced");
  assert.equal(pass.calls,1);
  const done=await inspectBackupQueue(A,factory);
  assert.equal(done?.status,"synced");
  assert.equal(done?.backup,null,"do not retain unnecessary diary payload after successful upload");
});

test("M6 queue: simultaneous tabs lease a single request, CAS conflict stays failed",async()=>{
  const {factory,backup}=await fixture();
  await enqueueBackup(A,backup,null,{confirmed:true,indexedDB:factory,now:1000});
  const delayed=mockClient("conflict",async()=>{await new Promise(resolve=>setTimeout(resolve,50));});
  const [first,second]=await Promise.all([
    sendQueuedBackup(delayed.client,A,{indexedDB:factory,now:2000}),
    sendQueuedBackup(delayed.client,A,{indexedDB:factory,now:2000}),
  ]);
  assert.equal(delayed.calls,1,"only one attempt across two active tabs");
  assert.deepEqual([first.status,second.status].sort(),["busy","failed"]);
  const state=await inspectBackupQueue(A,factory);
  assert.equal(state?.status,"failed");
  assert.equal(state?.errorCode,"CONFLICT");
  assert.equal(state?.attempts,1);
});

test("M6 queue: account switching during RPC cannot mark another account synced",async()=>{
  const {factory,store,backup}=await fixture();
  await enqueueBackup(A,backup,null,{confirmed:true,indexedDB:factory,now:1000});
  const changing=mockClient("pass",()=>chooseAccountWorkspace(B,auth(B),store).then(()=>{}));
  const r=await sendQueuedBackup(changing.client,A,{indexedDB:factory,now:2000});
  assert.equal(r.status,"failed");
  assert.equal(changing.calls,1);
  assert.equal(await inspectBackupQueue(B,factory),null,"account B has no pending A snapshot");
  await chooseAccountWorkspace(A,auth(A),store);
  const state=await inspectBackupQueue(A,factory);
  assert.equal(state?.status,"pending","A queue not changed by B's session");
  assert.equal(state?.leaseToken!==null,true);
});
