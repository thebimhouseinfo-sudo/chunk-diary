import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const ROOT = process.env.M1_TEST_ORIGIN ?? "http://127.0.0.1:4173";
const accountA = { kind: "account" as const, userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const accountB = { kind: "account" as const, userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };

test("real Chromium: same-origin beta-v4 data persists through scoped restore and reload", { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(ROOT + "/tests/browser/m1-harness.html");
    await page.waitForFunction(() => Boolean((window as any).m1Ready));

    const beforeDatabases = await page.evaluate(async () =>
      (await indexedDB.databases()).map((d) => d.name),
    );
    assert.deepEqual(beforeDatabases, []);

    // Seed the *original beta* schema in a real Chromium origin, not just a
    // fake IDB module; use the checked-in synthetic fixture, never user data.
    await page.evaluate(async () => {
      const f = await (await fetch("/tests/fixtures/beta-v4.fixture.json")).json();
      const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("LanguageChunkDiaryDB", 4);
        req.onupgradeneeded = () => {
          for (const name of Object.keys(f.stores)) {
            const s = req.result.createObjectStore(name, {
              keyPath: name === "settings" ? "key" : "id",
            });
            if (name === "meaningUnits") s.createIndex("diaryId", "diaryId");
            if (name === "chunks") {
              s.createIndex("meaningUnitId", "meaningUnitId");
              s.createIndex("semanticGroupId", "semanticGroupId");
            }
            if (name === "englishChunks") {
              s.createIndex("specialty", "specialty");
              s.createIndex("packageId", "packageId");
            }
            if (name === "userProgress") s.createIndex("userId", "userId");
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction(Object.keys(f.stores), "readwrite");
        for (const [name, entries] of Object.entries(f.stores) as [string, unknown[]][]) {
          for (const row of entries) tx.objectStore(name).put(row);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      idb.close();
      const story = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("StoryChatDB", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("sessions", { keyPath: "id" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = story.transaction("sessions", "readwrite");
        for (const item of f.storySessions) tx.objectStore("sessions").put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      story.close();
      for (const [key, value] of Object.entries(f.localSettings)) {
        localStorage.setItem(key, value as string);
      }
    });

    const result = await page.evaluate(async ({ a, b }) => {
      const m1 = (window as any).m1;
      const backup = await m1.captureLegacyBackup();
      const snapshotBefore = JSON.stringify(backup.snapshot);
      const preview = await m1.previewScopedImport(backup, a);
      const namesBefore = (await indexedDB.databases()).map((d) => d.name);
      const ra = await m1.importIntoScopedWorkspace(backup, a, { confirmed: true });
      const rb = await m1.importIntoScopedWorkspace(backup, b, { confirmed: true });
      const va = await m1.verifyScopedImport(a);
      const vb = await m1.verifyScopedImport(b);
      let blockedOverwrite = false;
      try {
        await m1.importIntoScopedWorkspace(backup, a, { confirmed: true });
      } catch {
        blockedOverwrite = true;
      }
      const snapshotAfter = JSON.stringify((await m1.captureLegacyBackup()).snapshot);
      return { backupChecksum: backup.checksum, preview, namesBefore, ra, rb, va, vb,
        blockedOverwrite, originalPreserved: snapshotBefore === snapshotAfter };
    }, { a: accountA, b: accountB });

    assert.equal(result.preview.canImport, true);
    assert.ok(!result.namesBefore.some((s: string) => s?.startsWith("ChunkDiaryWorkspace")));
    assert.ok(result.originalPreserved);
    assert.equal(result.ra.checksum, result.backupChecksum);
    assert.equal(result.va.checksum, result.backupChecksum);
    assert.equal(result.vb.checksum, result.backupChecksum);
    assert.notEqual(result.ra.destinationName, result.rb.destinationName);
    assert.equal(result.blockedOverwrite, true);

    // Reload from the SAME origin and check that both the original legacy DB
    // and the isolated owner workspaces survive a real Chromium page reload.
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).m1Ready));
    const after = await page.evaluate(async ({ a, b }) => {
      const m1 = (window as any).m1;
      const old = await m1.captureLegacyBackup();
      const verifiedA = await m1.verifyScopedImport(a);
      const verifiedB = await m1.verifyScopedImport(b);
      return {
        checksum: old.checksum,
        verifiedA: verifiedA.checksum,
        verifiedB: verifiedB.checksum,
        count: old.counts.chunks,
        story: old.storySessionCount,
        version: (await indexedDB.databases()).find((x) => x.name === "LanguageChunkDiaryDB")?.version,
      };
    }, { a: accountA, b: accountB });
    assert.equal(after.checksum, result.backupChecksum);
    assert.equal(after.verifiedA, result.backupChecksum);
    assert.equal(after.verifiedB, result.backupChecksum);
    assert.equal(after.count, 2);
    assert.equal(after.story, 1);
    assert.equal(after.version, 4);
    assert.deepEqual(consoleErrors, [], "real browser console must have no page errors");
    await context.close();
  } finally {
    await browser.close();
  }
});
