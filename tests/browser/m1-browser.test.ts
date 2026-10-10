import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";

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

async function startVite(cwd: string, port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, [
    "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort",
  ], { cwd, stdio: "pipe", env: { ...process.env, CI: "true" } });
  let log = "";
  child.stdout?.on("data", (data: Buffer) => { log += String(data); });
  child.stderr?.on("data", (data: Buffer) => { log += String(data); });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error("Vite exited early: " + log);
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/",
        { signal: AbortSignal.timeout(800) });
      if (response.ok) return child;
    } catch { /* server startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill("SIGTERM");
  throw new Error("Vite did not start: " + log);
}
async function stopVite(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 3500).unref();
  });
}

test("real Chromium: actual beta main app source replaced by dev app on one origin, local library retained", { timeout: 150000 }, async () => {
  const betaDir = process.cwd() + "/beta-baseline";
  const port = 4191;
  const origin = "http://127.0.0.1:" + port;
  const browser = await chromium.launch({ headless: true });
  let server: ChildProcess | undefined;
  try {
    const page = await browser.newPage();
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    server = await startVite(betaDir, port);
    await page.goto(origin + "/", { waitUntil: "load" });
    await page.waitForFunction(async () =>
      (await indexedDB.databases()).some((db) => db.name === "LanguageChunkDiaryDB" && db.version === 4),
    { timeout: 15000 });
    const original = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("LanguageChunkDiaryDB", 4);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const diary = {
        id: "direct-cutover-diary", title: "Synthetic beta diary",
        content: "Testing storage compatibility, no personal data.",
        createdAt: "2026-10-10T00:00:00.000Z", specialOldFlag: { retained: true },
      };
      const unit = {
        id: "direct-cutover-unit", diaryId: diary.id,
        nativeText: "Tôi đang kiểm tra dữ liệu.",
        englishPivot: "I am testing the data.", order: 0,
      };
      const chunk = {
        id: "direct-cutover-chunk", meaningUnitId: unit.id,
        semanticGroupId: "direct-cutover-group", language: "English",
        text: "testing the data", meaning: "kiểm tra dữ liệu", ipa: "",
        romanization: "", chunkType: "common",
        stars: 5, bestAccuracy: 92, timesPracticed: 37,
        lastPracticed: "2026-10-09T00:00:00.000Z", totalReviews: 43,
        averageRating: 4.2, lastRating: 5,
        lastReviewed: "2026-10-09T00:00:00.000Z",
        sourceDiaryId: diary.id, sourceDiaryTitle: diary.title,
        extraBetaValue: { userDefined: true },
      };
      const group = {
        id: "direct-cutover-group", canonicalMeaning: "testing the data",
        coverageLevel: 2, createdAt: "2026-10-10T00:00:00.000Z",
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["diaries", "meaningUnits", "chunks", "semanticGroups"], "readwrite");
        tx.objectStore("diaries").put(diary);
        tx.objectStore("meaningUnits").put(unit);
        tx.objectStore("chunks").put(chunk);
        tx.objectStore("semanticGroups").put(group);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      localStorage.setItem("story_chat_settings", JSON.stringify({ theme: "system", defaultInputMode: "typing" }));
      return { diary, unit, chunk, group };
    });
    assert.ok((await page.locator("body").innerText()).includes("ChunkDiary"));

    // Stop the beta main source server; bring up development app on the
    // IDENTICAL hostname, port and browser context with persistent IndexedDB.
    await stopVite(server);
    server = await startVite(process.cwd(), port);
    await page.goto(origin + "/", { waitUntil: "load" });
    await page.waitForFunction(async () =>
      (await indexedDB.databases()).some((db) => db.name === "LanguageChunkDiaryDB" && db.version === 4),
    { timeout: 15000 });
    const upgraded = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("LanguageChunkDiaryDB", 4);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const tx = db.transaction(["diaries", "meaningUnits", "chunks", "semanticGroups"], "readonly");
        const diary = tx.objectStore("diaries").get("direct-cutover-diary");
        const unit = tx.objectStore("meaningUnits").get("direct-cutover-unit");
        const chunk = tx.objectStore("chunks").get("direct-cutover-chunk");
        const group = tx.objectStore("semanticGroups").get("direct-cutover-group");
        tx.oncomplete = () => resolve({
          diary: diary.result, unit: unit.result, chunk: chunk.result, group: group.result,
        });
        tx.onerror = () => reject(tx.error);
      });
      const version = db.version;
      db.close();
      return { ...data, version, setting: localStorage.getItem("story_chat_settings") };
    });
    for (const name of ["diary", "unit", "chunk", "group"] as const) {
      assert.deepEqual(upgraded[name], original[name], name + " must survive beta-to-dev cutover");
    }
    assert.equal(upgraded.version, 4);
    assert.equal(upgraded.setting, JSON.stringify({ theme: "system", defaultInputMode: "typing" }));
    const rendered = await page.locator("body").innerText();
    assert.ok(rendered.includes("ChunkDiary"),
      "Dev app did not render after cutover: " + rendered.slice(0, 500) +
      " | page errors: " + runtimeErrors.join(" | "));
    assert.deepEqual(runtimeErrors, []);
  } finally {
    if (server) await stopVite(server);
    await browser.close();
  }
});


test("real Chromium Settings: local backup downloads and restore-file validation never writes into beta DB", { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto(ROOT + "/", { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    assert.ok(body.includes("Cài đặt"),
      "Settings route unavailable. HTTP " + response?.status() + " Body: " + body.slice(0, 500) +
      " | Errors: " + pageErrors.join(" | "));
    await page.getByRole("button", { name: "Cài đặt" }).first().click();
    await page.getByRole("button", { name: "Tải bản sao dữ liệu local" }).waitFor();

    const original = await page.evaluate(async () => (window as any).indexedDB.databases());
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Tải bản sao dữ liệu local" }).click(),
    ]);
    assert.match(download.suggestedFilename(), /^chunkdiary-backup-\d{4}-\d\d-\d\d\.json$/);
    const backup = JSON.parse(await readFile(await download.path(), "utf8"));
    assert.equal(backup.format, "chunkdiary.beta-v4.snapshot");
    assert.equal(backup.snapshot.source.dbVersion, 4);
    assert.equal(typeof backup.checksum, "string");
    assert.equal(backup.checksum.length, 64);
    assert.ok(backup.counts.chunks >= 1, "app's own seed records should be included");

    const picker = page.getByLabel("Tệp sao lưu ChunkDiary");
    await picker.setInputFiles({
      name: "valid-chunkdiary.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup), "utf8"),
    });
    const preview = page.getByTestId("backup-preview");
    await preview.waitFor();
    assert.match(await preview.innerText(), /chưa nhập dữ liệu vào ứng dụng/i);
    assert.match(await preview.innerText(), /SHA-256:/);

    const altered = structuredClone(backup);
    altered.snapshot.stores.chunks[0].stars = 999;
    await picker.setInputFiles({
      name: "tampered.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(altered), "utf8"),
    });
    await page.getByRole("alert").waitFor();
    assert.match(await page.getByRole("alert").innerText(), /checksum mismatch/);
    assert.equal(await preview.count(), 0, "invalid input must discard previous preview");

    // File selection must not write to any app stores or create workspaces.
    const after = await page.evaluate(async () => (window as any).indexedDB.databases());
    assert.deepEqual(after, original);
    assert.ok(!after.some((db: {name?: string}) => db.name?.startsWith("ChunkDiaryWorkspace")));
    await context.close();
  } finally {
    await browser.close();
  }
});
