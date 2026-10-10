import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveDiary, getDiaries, openDB } from "../src/db/indexedDb.ts";
import { chooseAccountWorkspace, chooseLocalWorkspace, resetWorkspaceRuntime } from "../src/db/workspaceRouter.ts";
import { saveSettings } from "../src/db/userDb.ts";
import { validateLegacyBackup } from "../src/db/legacySnapshot.ts";
import {
  createManualWorkspaceBackup, uploadManualCloudBackup,
  inspectManualCloudBackup, restoreManualCloudBackup,
} from "../src/services/supabase/manualBackup.ts";
import { syncSettingsToCloud, restoreProgressFromCloud } from "../src/services/supabase/cloudSync.ts";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const valid = async () => ({ id: A, isAnonymous: false });
type AuthIdentity = { id: string; is_anonymous: boolean } | null;
function clientMock() {
  let identity: AuthIdentity = { id:A, is_anonymous:false };
  let payload: unknown = null;
  let writes = 0;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: identity }, error: null }),
    },
    rpc: async (name: string, args: {
      p_payload: { ownerUserId: string; backup: {checksum: string} };
      p_expected_checksum: string | null;
    }) => {
      assert.equal(name, "chunkdiary_snapshot_cas_write");
      assert.equal(args.p_payload.ownerUserId, A);
      const previous = (payload as typeof args.p_payload | null)?.backup.checksum ?? null;
      if (previous !== args.p_expected_checksum) {
        return { data: { allowed: false, reason: "CONFLICT" }, error: null };
      }
      writes++;
      payload = args.p_payload;
      return { data: { allowed: true, checksum: args.p_payload.backup.checksum }, error: null };
    },
    from: (table: string) => {
      assert.equal(table, "sync_snapshots", "must not access arbitrary tables");
      return {
        select: (column: string) => {
          assert.equal(column, "payload");
          return {
            eq: (key: string, id: string) => {
              assert.equal(key, "user_id");
              assert.equal(id, A);
              return {
                maybeSingle: async () => ({ data: payload ? { payload } : null, error:null }),
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return {
    client, setUser: (id: string | null, anonymous=false) => {
      identity = id ? {id, is_anonymous:anonymous} : null;
    }, get writes() {return writes;},
    get payload() {return payload;},
  };
}
function memoryStorage() {
  const map = new Map<string,string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string,value: string) => {map.set(key,value);},
    removeItem: (key: string) => {map.delete(key);},
  };
}
function setupFactory() {
  (globalThis as {indexedDB: IDBFactory}).indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
}
test("M6: manual owner backup has complete current changes, never uploads automatically",async () => {
  setupFactory();
  resetWorkspaceRuntime();
  const storage=memoryStorage();
  (globalThis as {localStorage: Storage}).localStorage=storage as unknown as Storage;
  await chooseAccountWorkspace(A,valid,storage);
  await saveDiary({id:"old-beta-id",title:"New account diary",content:"Updated chapter",createdAt:new Date().toISOString()});
  await saveSettings({nickname:"Owner A",nativeLanguage:"Vietnamese",learningLanguages:["Japanese"],
    learningPurpose:"hobby",onboarded:true});
  const backup=await createManualWorkspaceBackup(A);
  await validateLegacyBackup(backup);
  assert.equal(backup.counts.diaries,1);
  assert.equal(backup.snapshot.stores.diaries[0].content,"Updated chapter");
  const mock=clientMock();
  assert.equal(mock.writes,0, "login and capture did not upload");

  await assert.rejects(uploadManualCloudBackup(mock.client,A,backup,{} as never),/consent/);
  mock.setUser(B);
  await assert.rejects(uploadManualCloudBackup(mock.client,A,backup,{confirmed:true}),/verification/);
  mock.setUser(A,true);
  await assert.rejects(uploadManualCloudBackup(mock.client,A,backup,{confirmed:true}),/verification/);
  mock.setUser(A,false);
  const receipt=await uploadManualCloudBackup(mock.client,A,backup,{confirmed:true});
  assert.equal(mock.writes,1);
  assert.equal(receipt.checksum,backup.checksum);
  await assert.rejects(uploadManualCloudBackup(mock.client,A,backup,{confirmed:true}),/CONFLICT/);
  assert.equal(mock.writes,1,"a second device cannot blind-overwrite existing cloud backup");
  await uploadManualCloudBackup(mock.client,A,backup,{
    confirmed:true, expectedRemoteChecksum:backup.checksum,
  });
  assert.equal(mock.writes,2,"a consented matching-CAS replacement succeeds");
  const seen=await inspectManualCloudBackup(mock.client,A);
  assert.equal(seen.backup.checksum,backup.checksum);
  assert.equal(seen.preview.canImport,false,"nonempty destination refuses overwrite");
  await assert.rejects(
    restoreManualCloudBackup(mock.client,A,seen.backup,{confirmed:true}),/already has local records/);
  chooseLocalWorkspace(storage);
  assert.equal((await getDiaries()).length,0,"Beta was not imported or mutated");
});

test("M6: cloud restore into EMPTY same-owner DB, preserving IDs and checksums",async () => {
  setupFactory();
  resetWorkspaceRuntime();
  const storage=memoryStorage();
  (globalThis as {localStorage: Storage}).localStorage=storage as unknown as Storage;
  await chooseAccountWorkspace(A,valid,storage);
  await saveDiary({id:"shared-id",title:"Saved",content:"My diary",createdAt:new Date().toISOString()});
  const mock=clientMock();
  const backup=await createManualWorkspaceBackup(A);
  await uploadManualCloudBackup(mock.client,A,backup,{confirmed:true});
  // A NEW browser/device with the same verified linked Auth user.
  setupFactory();
  chooseLocalWorkspace(storage);
  await chooseAccountWorkspace(A,valid,storage);
  const preview=await inspectManualCloudBackup(mock.client,A);
  assert.equal(preview.preview.canImport,true);
  const restored=await restoreManualCloudBackup(mock.client,A,preview.backup,{confirmed:true});
  assert.equal(restored.checksum,backup.checksum);
  assert.equal((await getDiaries())[0]?.id,"shared-id");
  assert.equal((await getDiaries())[0]?.content,"My diary");
  await assert.rejects(restoreManualCloudBackup(mock.client,A,preview.backup,{confirmed:true}),/already has local records/);
});

test("M6 negative: owner mismatch and disabled legacy sync cannot upload or restore",async () => {
  setupFactory();
  resetWorkspaceRuntime();
  const storage=memoryStorage();
  (globalThis as {localStorage: Storage}).localStorage=storage as unknown as Storage;
  await chooseAccountWorkspace(A,valid,storage);
  const db = await openDB(); // Empty but schema-valid account workspace.
  db.close();
  const mock=clientMock();
  const empty=await createManualWorkspaceBackup(A);
  await assert.rejects(uploadManualCloudBackup(mock.client,A,empty,{confirmed:true}),/Empty workspace/);
  assert.equal(mock.writes,0);
  await assert.rejects(inspectManualCloudBackup(mock.client,B),/matching account/);
  await assert.rejects(syncSettingsToCloud({nativeLanguage:"en",learningLanguages:["ja"],learningPurpose:"hobby",onboarded:true}),/disabled/);
  await assert.rejects(restoreProgressFromCloud(),/disabled/);
  assert.equal(mock.writes,0);
});
