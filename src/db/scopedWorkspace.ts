import {
  LEGACY_STORES, fingerprintLegacySnapshot, inspectLegacySnapshot,
  type LegacyRecord, type LegacySnapshot, type LegacyStoreName,
} from "./legacyCompatibility";
import { validateLegacyBackup, type LegacyBackup } from "./legacySnapshot";

export type WorkspaceOwner = { kind: "guest" } | { kind: "account"; userId: string };
export const WORKSPACE_DB_VERSION = 1;
const PREFIX = "ChunkDiaryWorkspace-v1-";
const EXTRA_STORES = ["storySessions", "localSettings", "__importMetadata"] as const;
export const WORKSPACE_STORES = [...LEGACY_STORES, ...EXTRA_STORES] as const;
type ImportMetadata = { key: "legacy-v4"; checksum: string; capturedAt: string };
type SettingRow = { key: string; value: string };
export type ImportReceipt = { destinationName: string; checksum: string; recordCount: number };
export type ImportPreview = ImportReceipt & { currentRecordCount: number; canImport: boolean };

export function workspaceDatabaseName(owner: WorkspaceOwner): string {
  if (owner.kind === "guest") return PREFIX + "guest";
  if (owner.kind !== "account" || typeof owner.userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(owner.userId)) {
    throw new Error("Workspace requires an explicit valid account UUID");
  }
  return PREFIX + "account-" + owner.userId.toLowerCase();
}

function setupStores(db: IDBDatabase): void {
  for (const store of LEGACY_STORES) {
    const obj = db.createObjectStore(store, { keyPath: store === "settings" ? "key" : "id" });
    if (store === "meaningUnits") obj.createIndex("diaryId", "diaryId", { unique: false });
    if (store === "chunks") {
      obj.createIndex("meaningUnitId", "meaningUnitId", { unique: false });
      obj.createIndex("semanticGroupId", "semanticGroupId", { unique: false });
    }
    if (store === "englishChunks") {
      obj.createIndex("specialty", "specialty", { unique: false });
      obj.createIndex("packageId", "packageId", { unique: false });
    }
    if (store === "userProgress") obj.createIndex("userId", "userId", { unique: false });
  }
  for (const name of EXTRA_STORES) {
    db.createObjectStore(name, { keyPath: name === "storySessions" ? "id" : "key" });
  }
}
function verifySchema(db: IDBDatabase): void {
  if (db.version !== WORKSPACE_DB_VERSION ||
      db.objectStoreNames.length !== WORKSPACE_STORES.length ||
      WORKSPACE_STORES.some((name) => !db.objectStoreNames.contains(name))) {
    throw new Error("Unsupported workspace schema");
  }
}

/**
 * Preview never creates a database. Creation is permitted only when importing
 * to a newly named isolated workspace. Never opens the legacy DB for writing.
 */
function openScoped(factory: IDBFactory, name: string, create: boolean): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = create ? factory.open(name, WORKSPACE_DB_VERSION) : factory.open(name);
    let absent = false;
    req.onupgradeneeded = () => {
      if (!create || req.result.objectStoreNames.length > 0) {
        absent = !create;
        req.transaction?.abort();
      } else {
        setupStores(req.result);
      }
    };
    req.onerror = () => absent ? resolve(null) : reject(req.error ?? new Error("Scoped DB open failed"));
    req.onblocked = () => reject(new Error("Workspace database blocked by another tab"));
    req.onsuccess = () => {
      try { verifySchema(req.result); resolve(req.result); }
      catch (error) { req.result.close(); reject(error); }
    };
  });
}
function countRecords(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...WORKSPACE_STORES], "readonly");
    let count = 0;
    for (const name of WORKSPACE_STORES) {
      const req = tx.objectStore(name).count();
      req.onsuccess = () => { count += req.result; };
    }
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error ?? new Error("Workspace count failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Workspace count aborted"));
  });
}
const backupCount = (backup: LegacyBackup) =>
  LEGACY_STORES.reduce((n, store) => n + backup.counts[store], backup.storySessionCount);

/** Strictly read-only. Unknown owner is an error, never a fallback to guest. */
export async function previewScopedImport(
  input: unknown, owner: WorkspaceOwner, factory: IDBFactory = indexedDB,
): Promise<ImportPreview> {
  const backup = await validateLegacyBackup(input);
  const destinationName = workspaceDatabaseName(owner);
  const db = await openScoped(factory, destinationName, false);
  let currentRecordCount = 0;
  if (db) {
    try { currentRecordCount = await countRecords(db); }
    finally { db.close(); }
  }
  return {
    destinationName, checksum: backup.checksum,
    recordCount: backupCount(backup), currentRecordCount,
    canImport: currentRecordCount === 0,
  };
}

/**
 * Atomic all-or-nothing restore to an EMPTY owner-scoped database.
 * The caller, not this helper, must obtain explicit consent for that owner.
 * Legacy beta DB, StoryChatDB and origin localStorage remain untouched.
 */
export async function importIntoScopedWorkspace(
  input: unknown,
  owner: WorkspaceOwner,
  options: { indexedDB?: IDBFactory; confirmed: true },
): Promise<ImportReceipt> {
  if (options?.confirmed !== true) throw new Error("Explicit confirmation required");
  const backup = await validateLegacyBackup(input);
  const destinationName = workspaceDatabaseName(owner);
  const db = await openScoped(options.indexedDB ?? indexedDB, destinationName, true);
  if (!db) throw new Error("Cannot create isolated workspace");
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([...WORKSPACE_STORES], "readwrite");
      let pending = WORKSPACE_STORES.length;
      let current = 0;
      let rejected = false;
      const fail = (err: Error) => { if (!rejected) { rejected = true; reject(err); } };
      tx.oncomplete = () => { if (!rejected) resolve(); };
      tx.onerror = () => fail(tx.error ?? new Error("Scoped import error"));
      tx.onabort = () => fail(tx.error ?? new Error("Scoped import aborted"));
      // All count requests and queued adds live in one transaction. No awaits.
      for (const name of WORKSPACE_STORES) {
        const request = tx.objectStore(name).count();
        request.onsuccess = () => {
          current += request.result;
          if (--pending !== 0) return;
          if (current !== 0) {
            fail(new Error("Workspace already has data; refusing to overwrite"));
            tx.abort();
            return;
          }
          try {
            for (const store of LEGACY_STORES) {
              const dst = tx.objectStore(store);
              for (const row of backup.snapshot.stores[store]) dst.add(row);
            }
            for (const session of backup.snapshot.storySessions) tx.objectStore("storySessions").add(session);
            for (const [key, value] of Object.entries(backup.snapshot.localSettings)) {
              tx.objectStore("localSettings").add({ key, value } satisfies SettingRow);
            }
            tx.objectStore("__importMetadata").add({
              key: "legacy-v4", checksum: backup.checksum, capturedAt: backup.capturedAt,
            } satisfies ImportMetadata);
          } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)));
            tx.abort();
          }
        };
      }
    });
    return { destinationName, checksum: backup.checksum, recordCount: backupCount(backup) };
  } finally {
    db.close();
  }
}

/**
 * Independent post-commit verification. This checks all records and
 * unknown fields against the original import digest, scoped by explicit owner.
 * Subsequent intentional edits will change the digest and are not supported
 * by this import-only verification contract.
 */
export async function verifyScopedImport(
  owner: WorkspaceOwner, factory: IDBFactory = indexedDB,
): Promise<ImportReceipt> {
  const destinationName = workspaceDatabaseName(owner);
  const db = await openScoped(factory, destinationName, false);
  if (!db) throw new Error("Scoped workspace does not exist");
  try {
    const values = await new Promise<Record<string, LegacyRecord[]>>((resolve, reject) => {
      const tx = db.transaction([...WORKSPACE_STORES], "readonly");
      const rows: Record<string, LegacyRecord[]> = {};
      for (const name of WORKSPACE_STORES) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { rows[name] = request.result as LegacyRecord[]; };
      }
      tx.oncomplete = () => resolve(rows);
      tx.onerror = () => reject(tx.error ?? new Error("Workspace read failed"));
      tx.onabort = () => reject(tx.error ?? new Error("Workspace read aborted"));
    });
    const marker = values.__importMetadata;
    if (marker.length !== 1 || marker[0].key !== "legacy-v4" || typeof marker[0].checksum !== "string") {
      throw new Error("Workspace missing verified import marker");
    }
    const settings = Object.fromEntries(values.localSettings.map((row) => [row.key, row.value]));
    const snapshot: LegacySnapshot = {
      source: { dbName: "LanguageChunkDiaryDB", dbVersion: 4, storyDbName: "StoryChatDB", storyDbVersion: 1 },
      stores: Object.fromEntries(LEGACY_STORES.map((name) => [name, values[name]])) as Record<LegacyStoreName, LegacyRecord[]>,
      storySessions: values.storySessions,
      localSettings: settings,
    };
    const inspection = inspectLegacySnapshot(snapshot);
    if (!inspection.compatibleShape) throw new Error("Workspace contains invalid records");
    const checksum = await fingerprintLegacySnapshot(snapshot);
    if (checksum !== marker[0].checksum) throw new Error("Workspace checksum mismatch");
    const recordCount = LEGACY_STORES.reduce((sum, store) => sum + inspection.counts[store], inspection.storySessionCount);
    return { destinationName, checksum, recordCount };
  } finally {
    db.close();
  }
}
