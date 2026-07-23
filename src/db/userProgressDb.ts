import { UserTargetChunkProgress } from "../types";
import { openDB } from "./indexedDb";

const STORE_NAME = "userProgress";

/**
 * Saves or updates a user learning progress record.
 */
export async function saveUserTargetProgress(progress: UserTargetChunkProgress): Promise<string> {
  const db = await openDB();
  if (!progress.id) progress.id = crypto.randomUUID();
  if (!progress.createdAt) progress.createdAt = new Date().toISOString();
  progress.updatedAt = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(progress);
    request.onsuccess = () => resolve(progress.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Batch saves multiple user learning progress records.
 */
export async function saveUserTargetProgressBatch(records: UserTargetChunkProgress[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    records.forEach(r => {
      if (!r.id) r.id = crypto.randomUUID();
      if (!r.createdAt) r.createdAt = new Date().toISOString();
      r.updatedAt = new Date().toISOString();
      store.put(r);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieves all user learning progress records.
 */
export async function getAllUserTargetProgress(): Promise<UserTargetChunkProgress[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as UserTargetChunkProgress[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Extracts all data required for device restore/backup:
 * Native Text + Target Chunks + Practice Progress Stats.
 */
export async function getUserRestorePackage(userId?: string): Promise<UserTargetChunkProgress[]> {
  const all = await getAllUserTargetProgress();
  if (userId) {
    return all.filter(r => r.userId === userId);
  }
  return all;
}

/**
 * Restores user learning records from a backup or cloud payload.
 */
export async function restoreUserTargetProgress(records: UserTargetChunkProgress[]): Promise<void> {
  await saveUserTargetProgressBatch(records);
}
