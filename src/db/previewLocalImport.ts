/**
 * Explicit, preview-only import into the local beta-compatible database.
 * NO implicit migration, NO cloud writes, NO overwrite of existing data.
 * The user selects a backup and confirms before calling this function.
 */
import { validateLegacyBackup, type LegacyBackup } from "./legacySnapshot";
import { LEGACY_STORES, LEGACY_DB_NAME, LEGACY_DB_VERSION, LEGACY_STORY_DB_NAME, LEGACY_STORY_DB_VERSION } from "./legacyCompatibility";
import { activeWorkspaceOwner } from "./workspaceRouter";
import { openDB } from "./indexedDb";

export type LocalImportPreview = { canImport: boolean; currentRecords: number; importRecords: number };

function openStoryDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(LEGACY_STORY_DB_NAME, LEGACY_STORY_DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("sessions")) req.result.createObjectStore("sessions", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Cannot open StoryChat database"));
    req.onblocked = () => reject(new Error("StoryChat is blocked in another tab"));
  });
}

function countStores(db: IDBDatabase, stores: readonly string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...stores], "readonly");
    let total = 0;
    for (const name of stores) {
      const req = tx.objectStore(name).count();
      req.onsuccess = () => { total += req.result; };
    }
    tx.oncomplete = () => resolve(total);
    tx.onerror = () => reject(tx.error ?? new Error("Cannot count workspace records"));
    tx.onabort = () => reject(tx.error ?? new Error("Cannot count workspace records"));
  });
}

const WELCOME = "Chào mừng bạn đến với ChunkDiary!";
function isPristineWelcome(rows: Record<string, Record<string, unknown>[]>): boolean {
  const diaries = rows.diaries ?? [], units = rows.meaningUnits ?? [], chunks = rows.chunks ?? [];
  if (diaries.length !== 1 || units.length !== 1 || chunks.length !== 1 ||
      ["semanticGroups", "englishChunks", "userProgress"].some(k => (rows[k] ?? []).length > 0)) return false;
  const [d] = diaries, [u] = units, [c] = chunks;
  return d.title === WELCOME && d.content === "Chào mừng bạn đã tham gia hành trình học ngôn ngữ tự nhiên thông qua các chunks." &&
    typeof d.id === "string" && u.diaryId === d.id && typeof u.id === "string" &&
    u.nativeText === WELCOME && u.englishPivot === "Welcome to ChunkDiary!" &&
    c.meaningUnitId === u.id && c.semanticGroupId === "welcome-group-1" &&
    c.text === "Welcome to" && c.meaning === "Chào mừng bạn đến với" &&
    c.totalReviews === 0 && c.timesPracticed === 0 && c.stars === 0 &&
    c.bestAccuracy === 0 && c.sourceDiaryId === d.id;
}
function readStores(db: IDBDatabase, names: readonly string[]): Promise<Record<string, Record<string, unknown>[]>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...names], "readonly");
    const rows: Record<string, Record<string, unknown>[]> = {};
    for (const name of names) {
      const req = tx.objectStore(name).getAll();
      req.onsuccess = () => { rows[name] = req.result; };
    }
    tx.oncomplete = () => resolve(rows);
    tx.onerror = () => reject(tx.error ?? new Error("Local read failed"));
  });
}
function writeStores(db: IDBDatabase, rows: Record<string, Record<string, unknown>[]>, stores: readonly string[], replaceSettings = false, replaceWelcome = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...stores], "readwrite");
    const prior: Record<string, Record<string, unknown>[]> = {};
    let pending = stores.length;
    for (const store of stores) {
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => {
        prior[store] = req.result;
        if (--pending !== 0) return;
        const content = stores.filter(name => name !== "settings");
        const hasContent = content.some(name => (prior[name] ?? []).length > 0);
        const seedOnly = replaceWelcome && isPristineWelcome(prior);
        if ((hasContent && !seedOnly) || (!replaceSettings && (prior.settings ?? []).length > 0)) {
          tx.abort();
          return;
        }
        try {
          for (const name of stores) {
            if ((replaceSettings && name === "settings") || (seedOnly && content.includes(name))) tx.objectStore(name).clear();
            for (const row of rows[name] ?? []) tx.objectStore(name).add(row);
          }
        } catch { tx.abort(); }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error("Local workspace contains non-default learning data; import aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Local import failed"));
  });
}

export async function previewLocalImport(input: unknown): Promise<LocalImportPreview> {
  if (activeWorkspaceOwner()?.kind === "account") throw new Error("Please switch to Local workspace first");
  const backup = await validateLegacyBackup(input);
  const db = await openDB();
  const story = await openStoryDb(indexedDB);
  try {
    if (db.name !== LEGACY_DB_NAME || db.version !== LEGACY_DB_VERSION || story.version !== LEGACY_STORY_DB_VERSION) {
      throw new Error("Incompatible local database version");
    }
    // App onboarding may pre-create preferences/settings. Learning content is the
    // only hard blocker; replacing preferences requires explicit import consent.
    const learningStores = LEGACY_STORES.filter(name => name !== "settings");
    const currentRecords = await countStores(db, learningStores) + await countStores(story, ["sessions"]);
    const currentRows = await readStores(db, LEGACY_STORES);
    const storyRecords = await countStores(story, ["sessions"]);
    return {
      canImport: (currentRecords === 0 || isPristineWelcome(currentRows) && storyRecords === 0),
      currentRecords,
      importRecords: LEGACY_STORES.reduce((sum, name) => sum + backup.counts[name], backup.storySessionCount),
    };
  } finally { db.close(); story.close(); }
}

export async function importPreviewLocalBackup(input: unknown, options: { confirmed: true }): Promise<void> {
  if (options?.confirmed !== true) throw new Error("Explicit import confirmation required");
  const backup: LegacyBackup = await validateLegacyBackup(input);
  const preflight = await previewLocalImport(backup);
  if (!preflight.canImport) throw new Error("Local workspace already contains learning data; refusing to overwrite");
  const db = await openDB();
  const story = await openStoryDb(indexedDB);
  try {
    // The two IndexedDB databases cannot share one atomic transaction. Write the
    // legacy main database first. On StoryChat error, remove only imported rows.
    const rows = backup.snapshot.stores as Record<string, Record<string, unknown>[]>;
    const previous = await readStores(db, LEGACY_STORES);
    await writeStores(db, rows, LEGACY_STORES, true, true);
    try {
      await writeStores(story, { sessions: backup.snapshot.storySessions }, ["sessions"]);
    } catch (error) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([...LEGACY_STORES], "readwrite");
        for (const name of LEGACY_STORES) {
          tx.objectStore(name).clear();
          for (const row of previous[name] ?? []) tx.objectStore(name).add(row);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      throw error;
    }
    for (const [key, value] of Object.entries(backup.snapshot.localSettings)) {
      localStorage.setItem(key, value);
    }
  } finally { db.close(); story.close(); }
  // Post-import verification is deliberately strict; caller shows success only after counts match.
  const verification = await previewLocalImportAfterWrite();
  const expected = LEGACY_STORES.reduce((sum, name) => sum + backup.counts[name], backup.storySessionCount);
  if (verification !== expected) throw new Error("Import count verification failed");
}

async function previewLocalImportAfterWrite(): Promise<number> {
  const db = await openDB();
  const story = await openStoryDb(indexedDB);
  try {
    return await countStores(db, LEGACY_STORES) + await countStores(story, ["sessions"]);
  } finally { db.close(); story.close(); }
}
