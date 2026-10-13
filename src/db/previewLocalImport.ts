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

function writeStores(db: IDBDatabase, rows: Record<string, Record<string, unknown>[]>, stores: readonly string[], replaceSettings = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...stores], "readwrite");
    // Repeat the empty check IN the writing transaction to avoid TOCTOU overwrite.
    let pending = stores.length;
    for (const store of stores) {
      const req = tx.objectStore(store).count();
      req.onsuccess = () => {
        if (req.result !== 0 && !(replaceSettings && store === "settings")) {
          tx.abort();
          return;
        }
        pending--;
        if (pending === 0) {
          for (const name of stores) {
            if (replaceSettings && name === "settings") tx.objectStore(name).clear();
            for (const row of rows[name] ?? []) tx.objectStore(name).add(row);
          }
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error("Local workspace is not empty, import aborted"));
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
    return {
      canImport: currentRecords === 0,
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
    const priorSettings = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const tx = db.transaction(["settings"], "readonly");
      const req = tx.objectStore("settings").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await writeStores(db, rows, LEGACY_STORES, true);
    try {
      await writeStores(story, { sessions: backup.snapshot.storySessions }, ["sessions"]);
    } catch (error) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([...LEGACY_STORES], "readwrite");
        for (const name of LEGACY_STORES) {
          const key = name === "settings" ? "key" : "id";
          for (const row of rows[name]) tx.objectStore(name).delete(row[key] as IDBValidKey);
        }
        tx.objectStore("settings").clear();
        for (const oldSetting of priorSettings) tx.objectStore("settings").add(oldSetting);
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
