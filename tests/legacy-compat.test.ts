import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEGACY_DB_VERSION,
  LEGACY_STORES,
  inspectLegacySnapshot,
  fingerprintLegacySnapshot,
  type LegacySnapshot,
} from "../src/db/legacyCompatibility.ts";

const load = async (): Promise<LegacySnapshot> => JSON.parse(
  await readFile(new URL("./fixtures/beta-v4.fixture.json", import.meta.url), "utf8"),
) as LegacySnapshot;

test("beta v4: recognizes all stores and StoryChat without modifying source records", async () => {
  const fixture = await load();
  const untouched = structuredClone(fixture);
  const inspected = inspectLegacySnapshot(fixture);
  assert.equal(LEGACY_DB_VERSION, 4);
  assert.equal(LEGACY_STORES.length, 7);
  assert.equal(inspected.compatibleShape, true);
  assert.deepEqual(inspected.counts, {
    diaries: 2, meaningUnits: 2, chunks: 2, semanticGroups: 1,
    settings: 1, englishChunks: 1, userProgress: 1,
  });
  assert.equal(inspected.storySessionCount, 1);
  assert.deepEqual(inspected.practice, { totalReviews: 16, timesPracticed: 15 });
  assert.deepEqual(fixture, untouched, "inspector must never normalize or mutate legacy records");
  assert.equal(fixture.stores.diaries[0].legacyCustomField, "must-survive");
  assert.deepEqual(fixture.stores.chunks[0].otherOldProperty, { must: "survive" });
});

test("beta v4 welcome seed may reference an absent optional semantic group", async () => {
  const inspected = inspectLegacySnapshot(await load());
  assert.deepEqual(
    inspected.issues.filter((issue) => issue.code === "DANGLING_SEMANTIC_GROUP").map((i) => i.id),
    ["beta-chunk-2"],
  );
  assert.equal(inspected.compatibleShape, true, "legacy warning must not delete or reject chunks");
});

test("fingerprint remains stable with object property ordering and store iteration order", async () => {
  const original = await load();
  const reordered = structuredClone(original);
  reordered.stores.diaries.reverse();
  const first = reordered.stores.chunks[0];
  reordered.stores.chunks[0] = Object.fromEntries(Object.entries(first).reverse());
  assert.equal(await fingerprintLegacySnapshot(original), await fingerprintLegacySnapshot(reordered));
});

test("NEGATIVE CONTROL: modifying stored practice statistics changes the fingerprint", async () => {
  const original = await load();
  const tampered = structuredClone(original);
  tampered.stores.chunks[0].timesPracticed = 0;
  assert.notEqual(
    await fingerprintLegacySnapshot(original),
    await fingerprintLegacySnapshot(tampered),
    "a lost practice count must be detected, not silently PASS",
  );
});

test("NEGATIVE CONTROL: unknown beta fields are included in loss detection", async () => {
  const original = await load();
  const tampered = structuredClone(original);
  delete tampered.stores.diaries[0].legacyCustomField;
  assert.notEqual(await fingerprintLegacySnapshot(original), await fingerprintLegacySnapshot(tampered));
});

test("dangling diary/meaning-unit links are warnings: old records remain recoverable", async () => {
  const snapshot = await load();
  snapshot.stores.meaningUnits[0].diaryId = "missing-diary";
  snapshot.stores.chunks[1].meaningUnitId = "missing-unit";
  const report = inspectLegacySnapshot(snapshot);
  assert.equal(report.compatibleShape, true);
  assert.ok(report.issues.some((i) => i.code === "DANGLING_DIARY"));
  assert.ok(report.issues.some((i) => i.code === "DANGLING_MEANING_UNIT"));
  assert.equal(report.counts.chunks, 2);
});

test("NEGATIVE CONTROL: duplicate legacy ID is an error, not overwritten", async () => {
  const snapshot = await load();
  snapshot.stores.diaries.push(structuredClone(snapshot.stores.diaries[0]));
  const report = inspectLegacySnapshot(snapshot);
  assert.equal(report.compatibleShape, false);
  assert.ok(report.issues.some((i) => i.code === "DUPLICATE_ID" && i.store === "diaries"));
});

test("invalid/missing beta stores and malformed records never receive false PASS", async () => {
  const snapshot = await load();
  delete (snapshot.stores as Record<string, unknown>).chunks;
  assert.equal(inspectLegacySnapshot(snapshot).compatibleShape, false);
  const malformed = await load();
  (malformed.stores.meaningUnits as unknown[]).push(null);
  assert.equal(inspectLegacySnapshot(malformed).compatibleShape, false);
  assert.equal(inspectLegacySnapshot(null).compatibleShape, false);
});

test("empty fresh beta-v4 database is valid, no onboarding or cloud session required", async () => {
  const fixture = await load();
  for (const store of LEGACY_STORES) fixture.stores[store] = [];
  fixture.storySessions = [];
  fixture.localSettings = {};
  assert.equal(inspectLegacySnapshot(fixture).compatibleShape, true);
});
