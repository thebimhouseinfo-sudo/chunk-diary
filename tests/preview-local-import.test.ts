import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { fingerprintLegacySnapshot, inspectLegacySnapshot, type LegacySnapshot } from "../src/db/legacyCompatibility.ts";
import { type LegacyBackup } from "../src/db/legacySnapshot.ts";
import { previewLocalImport, importPreviewLocalBackup } from "../src/db/previewLocalImport.ts";
import { resetWorkspaceRuntime } from "../src/db/workspaceRouter.ts";
import { getDiaries, getChunks, preseedDatabaseIfEmpty } from "../src/db/indexedDb.ts";

test("M7 preview: real legacy fixture imports to EMPTY Local and refuses repeat overwrite", async () => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
  const values = new Map<string,string>();
  (globalThis as unknown as {localStorage: Storage}).localStorage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k,v); },
    removeItem: (k: string) => { values.delete(k); },
  } as Storage;
  resetWorkspaceRuntime();
  const snapshot = JSON.parse(await readFile(new URL("./fixtures/beta-v4.fixture.json", import.meta.url), "utf8")) as LegacySnapshot;
  const report = inspectLegacySnapshot(snapshot);
  const backup: LegacyBackup = {
    format: "chunkdiary.beta-v4.snapshot", formatVersion: 1,
    capturedAt: "2026-10-10T00:00:00Z", snapshot,
    checksum: await fingerprintLegacySnapshot(snapshot),
    counts: report.counts, storySessionCount: report.storySessionCount,
  };
  // Simulate first-run onboarding preferences that must not block a real backup.
  localStorage.setItem("user_settings", JSON.stringify({ nickname: "Preview default", onboarded: true }));
  const existing = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("LanguageChunkDiaryDB", 4);
    req.onupgradeneeded = () => {
      for (const name of Object.keys(snapshot.stores)) req.result.createObjectStore(name, { keyPath: name === "settings" ? "key" : "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = existing.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ key: "onboarding", value: "default" });
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  existing.close();
  const before = await previewLocalImport(backup);
  assert.equal(before.canImport,true);
  await assert.rejects(
    importPreviewLocalBackup(backup, {} as {confirmed:true}),
    /confirmation/
  );
  await importPreviewLocalBackup(backup,{confirmed:true});
  assert.equal((await getDiaries()).length, report.counts.diaries);
  assert.equal((await getChunks()).length, report.counts.chunks);
  assert.equal(localStorage.getItem("user_settings"), snapshot.localSettings.user_settings);
  const after = await previewLocalImport(backup);
  assert.equal(after.canImport,false);
  await assert.rejects(importPreviewLocalBackup(backup,{confirmed:true}),/refusing to overwrite/);
  assert.equal((await getChunks()).length,report.counts.chunks);
});

test("M7: pristine app welcome seed may be replaced; edited seed is protected", async () => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
  const values = new Map<string,string>();
  (globalThis as unknown as {localStorage: Storage}).localStorage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k,v); },
    removeItem: (k: string) => { values.delete(k); },
  } as Storage;
  resetWorkspaceRuntime();
  const snapshot = JSON.parse(await readFile(new URL("./fixtures/beta-v4.fixture.json", import.meta.url), "utf8")) as LegacySnapshot;
  const report = inspectLegacySnapshot(snapshot);
  const backup: LegacyBackup = {
    format: "chunkdiary.beta-v4.snapshot", formatVersion: 1, capturedAt: "2026-10-10T00:00:00Z",
    snapshot, checksum: await fingerprintLegacySnapshot(snapshot), counts: report.counts,
    storySessionCount: report.storySessionCount,
  };
  await preseedDatabaseIfEmpty();
  assert.equal((await getDiaries()).length, 1);
  const debugDb = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("LanguageChunkDiaryDB", 4);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const debugStores: Record<string, unknown[]> = {};
  for (const name of ["diaries","meaningUnits","chunks","semanticGroups","englishChunks","userProgress"]) {
    debugStores[name] = await new Promise<unknown[]>((resolve,reject) => {
      const req = debugDb.transaction(name).objectStore(name).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  debugDb.close();
  console.log("WELCOME_FIXTURE_DIAGNOSTIC", JSON.stringify(debugStores));
  assert.equal((await previewLocalImport(backup)).canImport, true);
  await importPreviewLocalBackup(backup, { confirmed: true });
  assert.equal((await getDiaries()).length, report.counts.diaries);
  assert.equal((await getChunks()).length, report.counts.chunks);
  assert.equal((await previewLocalImport(backup)).canImport, false);
});
