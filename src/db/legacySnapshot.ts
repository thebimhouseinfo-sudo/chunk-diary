import {
  LEGACY_DB_NAME,
  LEGACY_DB_VERSION,
  LEGACY_LOCAL_SETTINGS_KEYS,
  LEGACY_STORES,
  LEGACY_STORY_DB_NAME,
  LEGACY_STORY_DB_VERSION,
  fingerprintLegacySnapshot,
  inspectLegacySnapshot,
  type LegacyRecord,
  type LegacySnapshot,
  type LegacyStoreName,
} from "./legacyCompatibility";

export const LEGACY_BACKUP_FORMAT = "chunkdiary.beta-v4.snapshot";
export const LEGACY_BACKUP_FORMAT_VERSION = 1;

export interface LegacyBackup {
  format: typeof LEGACY_BACKUP_FORMAT;
  formatVersion: typeof LEGACY_BACKUP_FORMAT_VERSION;
  capturedAt: string;
  snapshot: LegacySnapshot;
  checksum: string;
  counts: Record<LegacyStoreName, number>;
  storySessionCount: number;
}

export interface LegacySnapshotEnvironment {
  indexedDB: IDBFactory;
  localStorage: Pick<Storage, "getItem">;
  now?: () => Date;
}

/**
 * Never creates an absent database: a versionless open() would otherwise
 * create version 1. Abort the upgrade before any new database is committed.
 * Existing databases are opened WITHOUT a version, so they are never upgraded.
 */
function openExistingDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    let missing = false;
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction?.abort();
    };
    request.onerror = () => {
      if (missing) resolve(null);
      else reject(request.error ?? new Error("Could not read existing IndexedDB"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (missing) {
        db.close();
        resolve(null);
      } else {
        resolve(db);
      }
    };
    request.onblocked = () => reject(new Error("IndexedDB read is blocked"));
  });
}

/** One readonly transaction per database; no cross-database atomicity assumed. */
function readStores(
  db: IDBDatabase,
  stores: readonly string[],
): Promise<Record<string, LegacyRecord[]>> {
  for (const name of stores) {
    if (!db.objectStoreNames.contains(name)) {
      return Promise.reject(new Error("Legacy IndexedDB missing store: " + name));
    }
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(rows);
    };
    const rows: Record<string, LegacyRecord[]> = {};
    let tx: IDBTransaction;
    try {
      tx = db.transaction([...stores], "readonly");
      for (const name of stores) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { rows[name] = request.result as LegacyRecord[]; };
      }
      tx.oncomplete = () => done();
      tx.onabort = () => done(tx.error ?? new Error("IndexedDB read transaction aborted"));
      tx.onerror = () => done(tx.error ?? new Error("IndexedDB read transaction failed"));
    } catch (cause) {
      done(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}

/**
 * Takes an in-memory snapshot. It never saves or uploads the snapshot.
 * Data belongs to the browser user; caller must obtain separate explicit
 * authorization before sending the result to a cloud provider.
 */
export async function captureLegacyBackup(
  env: LegacySnapshotEnvironment = {
    indexedDB: indexedDB,
    localStorage: localStorage,
  },
): Promise<LegacyBackup> {
  const db = await openExistingDatabase(env.indexedDB, LEGACY_DB_NAME);
  if (!db) throw new Error("Legacy beta database not found; no database was created");

  let stores: Record<LegacyStoreName, LegacyRecord[]>;
  try {
    if (db.version !== LEGACY_DB_VERSION) {
      throw new Error("Unsupported legacy database version: " + db.version);
    }
    stores = await readStores(db, LEGACY_STORES) as Record<LegacyStoreName, LegacyRecord[]>;
  } finally {
    db.close();
  }

  const story = await openExistingDatabase(env.indexedDB, LEGACY_STORY_DB_NAME);
  let storySessions: LegacyRecord[] = [];
  if (story) {
    try {
      if (story.version !== LEGACY_STORY_DB_VERSION) {
        throw new Error("Unsupported StoryChat database version: " + story.version);
      }
      const rows = await readStores(story, ["sessions"]);
      storySessions = rows.sessions;
    } finally {
      story.close();
    }
  }

  const localSettings: Record<string, string> = {};
  for (const key of LEGACY_LOCAL_SETTINGS_KEYS) {
    const value = env.localStorage.getItem(key);
    if (value !== null) localSettings[key] = value;
  }

  const snapshot: LegacySnapshot = {
    source: {
      dbName: LEGACY_DB_NAME,
      dbVersion: LEGACY_DB_VERSION,
      storyDbName: LEGACY_STORY_DB_NAME,
      storyDbVersion: LEGACY_STORY_DB_VERSION,
    },
    stores,
    storySessions,
    localSettings,
  };

  const inspection = inspectLegacySnapshot(snapshot);
  if (!inspection.compatibleShape) {
    // Never drop malformed records to make a snapshot appear valid.
    throw new Error("Legacy snapshot failed structural validation: " +
      inspection.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code).join(", "));
  }
  // Throws for non-JSON-safe structured-clone values instead of losing fields.
  const checksum = await fingerprintLegacySnapshot(snapshot);
  return {
    format: LEGACY_BACKUP_FORMAT,
    formatVersion: LEGACY_BACKUP_FORMAT_VERSION,
    capturedAt: (env.now?.() ?? new Date()).toISOString(),
    snapshot,
    checksum,
    counts: inspection.counts,
    storySessionCount: inspection.storySessionCount,
  };
}

/** Validates user-provided backup without changing browser data. */
export async function validateLegacyBackup(value: unknown): Promise<LegacyBackup> {
  if (!value || typeof value !== "object") throw new Error("Invalid legacy backup");
  const backup = value as Partial<LegacyBackup>;
  if (backup.format !== LEGACY_BACKUP_FORMAT || backup.formatVersion !== LEGACY_BACKUP_FORMAT_VERSION ||
      !backup.snapshot || !backup.counts || typeof backup.checksum !== "string" ||
      typeof backup.capturedAt !== "string" || !Number.isFinite(Date.parse(backup.capturedAt))) {
    throw new Error("Invalid legacy backup envelope");
  }
  const report = inspectLegacySnapshot(backup.snapshot);
  if (!report.compatibleShape) throw new Error("Invalid legacy backup records");
  // The digest intentionally canonicalizes the seven known stores. Reject extras
  // rather than silently ignoring data an imported snapshot may contain.
  const storeNames = Object.keys(backup.snapshot.stores);
  if (storeNames.length !== LEGACY_STORES.length ||
      storeNames.some((name) => !(LEGACY_STORES as readonly string[]).includes(name))) {
    throw new Error("Legacy backup has unrecognized stores");
  }
  // An imported backup must never smuggle provider tokens or origin-wide secrets
  // into a future localStorage restore flow.
  for (const [key, value] of Object.entries(backup.snapshot.localSettings)) {
    if (!(LEGACY_LOCAL_SETTINGS_KEYS as readonly string[]).includes(key) || typeof value !== "string") {
      throw new Error("Legacy backup has unrecognized local settings");
    }
  }
  for (const store of LEGACY_STORES) {
    if (backup.counts[store] !== report.counts[store]) {
      throw new Error("Legacy backup store count mismatch: " + store);
    }
  }
  if (backup.storySessionCount !== report.storySessionCount) {
    throw new Error("Legacy backup story session count mismatch");
  }
  if (await fingerprintLegacySnapshot(backup.snapshot) !== backup.checksum) {
    throw new Error("Legacy backup checksum mismatch");
  }
  return backup as LegacyBackup;
}
