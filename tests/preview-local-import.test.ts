import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { fingerprintLegacySnapshot, inspectLegacySnapshot, type LegacySnapshot } from "../src/db/legacyCompatibility.ts";
import { type LegacyBackup } from "../src/db/legacySnapshot.ts";
import { previewLocalImport, importPreviewLocalBackup } from "../src/db/previewLocalImport.ts";
import { resetWorkspaceRuntime } from "../src/db/workspaceRouter.ts";
import { getDiaries, getChunks } from "../src/db/indexedDb.ts";

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
  const before = await previewLocalImport(backup);
  assert.equal(before.canImport,true);
  await assert.rejects(
    importPreviewLocalBackup(backup, {} as {confirmed:true}),
    /confirmation/
  );
  await importPreviewLocalBackup(backup,{confirmed:true});
  assert.equal((await getDiaries()).length, report.counts.diaries);
  assert.equal((await getChunks()).length, report.counts.chunks);
  const after = await previewLocalImport(backup);
  assert.equal(after.canImport,false);
  await assert.rejects(importPreviewLocalBackup(backup,{confirmed:true}),/refusing to overwrite/);
  assert.equal((await getChunks()).length,report.counts.chunks);
});
