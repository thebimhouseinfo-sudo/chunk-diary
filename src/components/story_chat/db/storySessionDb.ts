export function openStoryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("StoryChatDB", 1);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

import { StorySession } from "../models/types";

export async function getActiveSession(): Promise<StorySession | null> {
  const db = await openStoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readonly");
    const store = tx.objectStore("sessions");
    const request = store.get("active"); // Direct single-key retrieval
    request.onsuccess = () => {
      resolve((request.result as StorySession) || null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(session: StorySession): Promise<void> {
  const db = await openStoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const request = store.put({ ...session, id: "active" }); // Ensure single key "active"
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearActiveSession(): Promise<void> {
  const db = await openStoryDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const request = store.delete("active"); // True deletion of the active session record
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
