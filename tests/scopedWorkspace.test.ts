import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { captureLegacyBackup, validateLegacyBackup, type LegacyBackup } from "../src/db/legacySnapshot.ts";
import {
  previewScopedImport, importIntoScopedWorkspace,
  verifyScopedImport, workspaceDatabaseName,
  type WorkspaceOwner,
} from "../src/db/scopedWorkspace.ts";
import { LEGACY_STORES, type LegacySnapshot } from "../src/db/legacyCompatibility.ts";

const A: WorkspaceOwner = { kind: "account", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const B: WorkspaceOwner = { kind: "account", userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
const G: WorkspaceOwner = { kind: "guest" };
const factory = (): IDBFactory => new FakeIDBFactory() as unknown as IDBFactory;
const fixture = async (): Promise<LegacySnapshot> =>
  JSON.parse(await readFile(new URL("./fixtures/beta-v4.fixture.json", import.meta.url), "utf8"));

async function seed(idb: IDBFactory): Promise<LegacyBackup> {
  const f = await fixture();
  for (const [name, version, contents] of [
    ["LanguageChunkDiaryDB", 4, f.stores],
    ["StoryChatDB", 1, { sessions: f.storySessions }],
  ] as const) {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = idb.open(name, version);
      req.onupgradeneeded = () => {
        for (const store of Object.keys(contents)) req.result.createObjectStore(store, { keyPath: store === "settings" ? "key" : "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(Object.keys(contents), "readwrite");
      for (const [store, records] of Object.entries(contents)) {
        for (const row of records) tx.objectStore(store).put(row);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }
  return captureLegacyBackup({
    indexedDB: idb,
    localStorage: { getItem: (key) => f.localSettings[key] ?? null },
    now: () => new Date("2026-10-10T00:00:00Z"),
  });
}
async function dbList(idb: IDBFactory): Promise<string[]> {
  return (await idb.databases()).map((d) => d.name ?? "").sort();
}

test("M1 preview validates data and never creates a destination database", async () => {
  const idb = factory();
  const backup = await seed(idb);
  const before = await dbList(idb);
  const preview = await previewScopedImport(backup, A, idb);
  assert.equal(preview.canImport, true);
  assert.equal(preview.currentRecordCount, 0);
  assert.equal(preview.recordCount, Object.values(backup.counts).reduce((a,b)=>a+b, backup.storySessionCount));
  assert.deepEqual(await dbList(idb), before);
});

test("M1 explicit import confirmation is mandatory, no side effects on refusal", async () => {
  const idb = factory();
  const backup = await seed(idb);
  const before = await dbList(idb);
  await assert.rejects(() => importIntoScopedWorkspace(backup, G, {indexedDB:idb} as never), /confirmation/);
  assert.deepEqual(await dbList(idb), before);
});

test("M1 full guest import is atomic and the original beta databases remain unchanged", async () => {
  const idb = factory();
  const backup = await seed(idb);
  const before = await captureLegacyBackup({
    indexedDB: idb,
    localStorage: {getItem:(key)=>backup.snapshot.localSettings[key]??null},
    now:()=>new Date("2026-10-10T00:00:00Z"),
  });
  const receipt = await importIntoScopedWorkspace(backup, G, { indexedDB:idb, confirmed:true });
  assert.equal(receipt.checksum, backup.checksum);
  assert.equal(receipt.destinationName, workspaceDatabaseName(G));
  assert.deepEqual(await verifyScopedImport(G, idb), receipt);
  assert.deepEqual(await captureLegacyBackup({
    indexedDB: idb,
    localStorage: {getItem:(key)=>backup.snapshot.localSettings[key]??null},
    now:()=>new Date("2026-10-10T00:00:00Z"),
  }), before);
  const list = await dbList(idb);
  assert.ok(list.includes("LanguageChunkDiaryDB"));
  assert.ok(list.includes("StoryChatDB"));
  assert.ok(list.includes(receipt.destinationName));
});

test("M1 accounts A/B may import identical legacy IDs but can only read their own workspace", async () => {
  const idb = factory();
  const backup = await seed(idb);
  const ar = await importIntoScopedWorkspace(backup, A, { indexedDB:idb, confirmed:true });
  const br = await importIntoScopedWorkspace(backup, B, { indexedDB:idb, confirmed:true });
  assert.notEqual(ar.destinationName, br.destinationName);
  assert.equal(ar.checksum, br.checksum);
  assert.equal((await verifyScopedImport(A,idb)).checksum, backup.checksum);
  assert.equal((await verifyScopedImport(B,idb)).checksum, backup.checksum);
  const previewA = await previewScopedImport(backup,A,idb);
  const previewB = await previewScopedImport(backup,B,idb);
  const previewG = await previewScopedImport(backup,G,idb);
  assert.equal(previewA.canImport, false);
  assert.equal(previewB.canImport, false);
  assert.equal(previewG.canImport, true);
});

test("NEGATIVE CONTROL: repeat import cannot overwrite existing or newer records", async () => {
  const idb = factory();
  const backup = await seed(idb);
  await importIntoScopedWorkspace(backup,A,{indexedDB:idb,confirmed:true});
  const changed = structuredClone(backup);
  changed.snapshot.stores.chunks[0].timesPracticed = 99;
  await assert.rejects(() => importIntoScopedWorkspace(changed,A,{indexedDB:idb,confirmed:true}), /checksum mismatch/);
  await assert.rejects(() => importIntoScopedWorkspace(backup,A,{indexedDB:idb,confirmed:true}), /already has data/);
  assert.equal((await verifyScopedImport(A,idb)).checksum, backup.checksum);
});

test("NEGATIVE CONTROL: tampered backup/unknown account creates no destination", async () => {
  const idb = factory();
  const backup = await seed(idb);
  const bad = structuredClone(backup);
  bad.counts.chunks += 10;
  await assert.rejects(() => importIntoScopedWorkspace(bad,B,{indexedDB:idb,confirmed:true}), /count mismatch/);
  await assert.rejects(() => previewScopedImport(backup,{kind:"account",userId:"../../other"},idb), /UUID/);
  assert.ok(!(await dbList(idb)).some((name)=>name.includes("Workspace")));
});

test("NEGATIVE CONTROL: modified scoped record is detected by post-import checksum", async () => {
  const idb = factory();
  const backup = await seed(idb);
  await importIntoScopedWorkspace(backup,A,{indexedDB:idb,confirmed:true});
  const db = await new Promise<IDBDatabase>((resolve,reject) => {
    const req=idb.open(workspaceDatabaseName(A),1);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  await new Promise<void>((resolve,reject) => {
    const tx=db.transaction("chunks","readwrite");
    tx.objectStore("chunks").put({...backup.snapshot.stores.chunks[0],stars:0});
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
  db.close();
  await assert.rejects(()=>verifyScopedImport(A,idb),/checksum mismatch/);
  await assert.rejects(()=>verifyScopedImport(B,idb),/does not exist/);
});

test("M1 scope preserves user-owned unknown fields, multiple settings and StoryChat", async () => {
  const idb=factory();
  const backup=await seed(idb);
  await importIntoScopedWorkspace(backup,G,{indexedDB:idb,confirmed:true});
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const req=idb.open(workspaceDatabaseName(G),1);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  const result=await new Promise<{diary:unknown; story:unknown; setting:unknown}>((resolve,reject)=>{
    const tx=db.transaction(["diaries","storySessions","localSettings"],"readonly");
    const d=tx.objectStore("diaries").get("beta-diary-1");
    const s=tx.objectStore("storySessions").get("active");
    const v=tx.objectStore("localSettings").get("user_settings");
    tx.oncomplete=()=>resolve({diary:d.result,story:s.result,setting:v.result});
    tx.onerror=()=>reject(tx.error);
  });
  db.close();
  assert.equal((result.diary as Record<string,unknown>).legacyCustomField,"must-survive");
  assert.equal((result.story as Record<string,unknown>).id,"active");
  assert.equal(typeof (result.setting as Record<string,unknown>).value,"string");
  assert.equal((await verifyScopedImport(G,idb)).checksum,backup.checksum);
});

test("M1 unsupported or partial workspace schema is rejected without mutation", async () => {
  const idb=factory();
  const backup=await seed(idb);
  const name=workspaceDatabaseName(A);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const req=idb.open(name,1);
    req.onupgradeneeded=()=>{req.result.createObjectStore("diaries",{keyPath:"id"});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  db.close();
  await assert.rejects(()=>previewScopedImport(backup,A,idb),/Unsupported workspace schema/);
  await assert.rejects(()=>importIntoScopedWorkspace(backup,A,{indexedDB:idb,confirmed:true}),/Unsupported workspace schema/);
});
