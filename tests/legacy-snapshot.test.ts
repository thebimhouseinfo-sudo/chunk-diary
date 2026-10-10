import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { captureLegacyBackup, validateLegacyBackup } from "../src/db/legacySnapshot.ts";
import type { LegacySnapshot, LegacyStoreName } from "../src/db/legacyCompatibility.ts";
import { LEGACY_STORES } from "../src/db/legacyCompatibility.ts";

const loadFixture = async (): Promise<LegacySnapshot> => JSON.parse(
  await readFile(new URL("./fixtures/beta-v4.fixture.json", import.meta.url), "utf8"),
);

function createFactory(): IDBFactory {
  return new FakeIDBFactory() as unknown as IDBFactory;
}
const keyFor = (name: LegacyStoreName): string => name === "settings" ? "key" : "id";

async function createDb(
  idb: IDBFactory,
  name: string,
  version: number,
  values: Record<string, Record<string, unknown>[]>,
): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(name, version);
    req.onupgradeneeded = () => {
      for (const store of Object.keys(values)) {
        req.result.createObjectStore(store, { keyPath: store === "settings" ? "key" : "id" });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
  try {
    const stores = Object.keys(values);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, "readwrite");
      for (const store of stores) {
        for (const row of values[store]) tx.objectStore(store).put(row);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function seedBeta(idb: IDBFactory, withStory = true): Promise<LegacySnapshot> {
  const fixture = await loadFixture();
  await createDb(idb, "LanguageChunkDiaryDB", 4, fixture.stores);
  if (withStory) await createDb(idb, "StoryChatDB", 1, { sessions: fixture.storySessions });
  return fixture;
}

const settings = (fixture: LegacySnapshot): Pick<Storage, "getItem"> => ({
  getItem: (key) => Object.hasOwn(fixture.localSettings, key) ? fixture.localSettings[key] : null,
});

test("M1 read-only capture: all 7 stores, StoryChat, statistics, extensions and checksum survive", async () => {
  const idb = createFactory();
  const fixture = await seedBeta(idb);
  const env = { indexedDB: idb, localStorage: settings(fixture), now: () => new Date("2026-10-10T07:00:00.000Z") };
  const before = await captureLegacyBackup(env);
  assert.equal(before.format, "chunkdiary.beta-v4.snapshot");
  assert.equal(before.formatVersion, 1);
  assert.equal(before.capturedAt, "2026-10-10T07:00:00.000Z");
  assert.equal(before.counts.chunks, 2);
  assert.equal(before.counts.userProgress, 1);
  assert.equal(before.storySessionCount, 1);
  assert.deepEqual(before.snapshot, fixture);
  assert.equal(before.snapshot.stores.chunks[0].timesPracticed, 12);
  assert.equal(before.snapshot.stores.diaries[0].legacyCustomField, "must-survive");
  assert.ok(/^[a-f0-9]{64}$/.test(before.checksum));
  assert.equal((await validateLegacyBackup(before)).checksum, before.checksum);
  const after = await captureLegacyBackup(env);
  assert.equal(before.checksum, after.checksum, "capture itself must never change DB");
  assert.equal((await idb.databases()).find((x) => x.name === "LanguageChunkDiaryDB")?.version, 4);
});

test("M1 missing required database fails WITHOUT creating any IndexedDB", async () => {
  const idb = createFactory();
  await assert.rejects(() => captureLegacyBackup({ indexedDB: idb, localStorage: {getItem:()=>null} }), /not found/);
  assert.equal((await idb.databases()).length, 0, "read-only export must never initialize a new database");
});

test("M1 absent optional StoryChat database is empty and stays uncreated", async () => {
  const idb = createFactory();
  const fixture = await seedBeta(idb, false);
  const backup = await captureLegacyBackup({ indexedDB: idb, localStorage: settings(fixture) });
  assert.equal(backup.storySessionCount, 0);
  assert.deepEqual(backup.snapshot.storySessions, []);
  assert.equal((await idb.databases()).some((x) => x.name === "StoryChatDB"), false);
});

test("M1 invalid versions or missing required stores fail without changing the database", async () => {
  const oldIdb = createFactory();
  await createDb(oldIdb, "LanguageChunkDiaryDB", 3, { diaries: [] });
  await assert.rejects(() => captureLegacyBackup({indexedDB:oldIdb,localStorage:{getItem:()=>null}}), /Unsupported legacy database version: 3/);
  assert.equal((await oldIdb.databases())[0]?.version, 3);

  const invalid = createFactory();
  await createDb(invalid, "LanguageChunkDiaryDB", 4, { diaries: [] });
  await assert.rejects(() => captureLegacyBackup({indexedDB:invalid,localStorage:{getItem:()=>null}}), /missing store/);
  assert.equal((await invalid.databases())[0]?.version, 4);
});

test("NEGATIVE CONTROL: tampering with chunk review stats, unknown field or manifest is rejected", async () => {
  const idb = createFactory();
  const fixture = await seedBeta(idb);
  const valid = await captureLegacyBackup({ indexedDB: idb, localStorage: settings(fixture) });
  const statLoss = structuredClone(valid);
  statLoss.snapshot.stores.chunks[0].stars = 0;
  await assert.rejects(() => validateLegacyBackup(statLoss), /checksum mismatch/);
  const unknownLoss = structuredClone(valid);
  delete unknownLoss.snapshot.stores.chunks[0].otherOldProperty;
  await assert.rejects(() => validateLegacyBackup(unknownLoss), /checksum mismatch/);
  const countLoss = structuredClone(valid);
  countLoss.counts.diaries = 8;
  await assert.rejects(() => validateLegacyBackup(countLoss), /count mismatch/);
});

test("NEGATIVE CONTROL: Date values are not silently serialized away", async () => {
  const idb = createFactory();
  const fixture = await seedBeta(idb);
  const request = idb.open("LanguageChunkDiaryDB");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["diaries"], "readwrite");
    tx.objectStore("diaries").put({...fixture.stores.diaries[0], extraDate: new Date("2026-01-10")});
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  await assert.rejects(() => captureLegacyBackup({indexedDB:idb,localStorage:settings(fixture)}), /structured-clone/);
});

test("M1 capture never includes arbitrary localStorage keys such as auth tokens", async () => {
  const idb = createFactory();
  await seedBeta(idb, false);
  const backup = await captureLegacyBackup({
    indexedDB:idb,
    localStorage:{getItem:(key) => key === "user_settings" ? '{"nickname":"Synthetic"}' : null},
  });
  assert.deepEqual(Object.keys(backup.snapshot.localSettings), ["user_settings"]);
  assert.ok(!JSON.stringify(backup).includes("access_token"));
});

test("M1 empty but existing beta database is valid and does not require login", async () => {
  const idb = createFactory();
  const values = Object.fromEntries(LEGACY_STORES.map((store)=>[store, []])) as Record<LegacyStoreName, Record<string, unknown>[]>;
  await createDb(idb, "LanguageChunkDiaryDB", 4, values);
  const backup = await captureLegacyBackup({indexedDB:idb,localStorage:{getItem:()=>null}});
  assert.equal(backup.counts.chunks, 0);
  assert.equal(backup.storySessionCount, 0);
  assert.deepEqual(backup.snapshot.localSettings, {});
});
