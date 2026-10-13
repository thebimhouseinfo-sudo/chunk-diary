import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { hasExistingLegacyWorkspace } from "../src/db/legacyPresence";

const factory = () => new IDBFactory();

test("fresh origin probe does not create legacy IndexedDB", async () => {
  const idb = factory();
  assert.equal(await hasExistingLegacyWorkspace(idb), false);
  assert.deepEqual(await idb.databases(), []);
  assert.equal(await hasExistingLegacyWorkspace(idb), false);
});

test("old beta IndexedDB is never overwritten, upgraded or claimed", async () => {
  const idb = factory();
  const request = idb.open("LanguageChunkDiaryDB", 4);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onupgradeneeded = () => request.result.createObjectStore("diaries", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("diaries", "readwrite");
    tx.objectStore("diaries").add({ id: "old-diary", content: "Preserve" });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  assert.equal(await hasExistingLegacyWorkspace(idb), true);
  const existing = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = idb.open("LanguageChunkDiaryDB");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  assert.equal(existing.version, 4);
  const row = await new Promise<{ content: string }>((resolve, reject) => {
    const r = existing.transaction("diaries", "readonly").objectStore("diaries").get("old-diary");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  assert.equal(row.content, "Preserve");
  existing.close();
});

test("unknown IndexedDB opening error fails closed and protects old data", async () => {
  const broken = { open: () => { throw new Error("permission denied"); } } as unknown as IDBFactory;
  assert.equal(await hasExistingLegacyWorkspace(broken), true);
});
