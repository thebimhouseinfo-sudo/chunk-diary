import { UserSettings } from "../types";

const DB_NAME = "LanguageChunkDiaryDB";
const STORE_NAME = "settings";

export async function openUserDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Lấy thông tin cấu hình người dùng từ IndexedDB
export async function getSettings(): Promise<UserSettings | null> {
  const db = await openUserDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("userConfig");
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

// Lưu thông tin cấu hình người dùng vào IndexedDB
export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await openUserDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key: "userConfig", value: settings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Clear all user settings from IndexedDB
export async function clearAllUserDb(): Promise<void> {
  const db = await openUserDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => {
      console.log("User settings cleared successfully.");
      resolve();
    };
    request.onerror = (event: any) => {
      console.error("Error clearing user settings:", event.target.error);
      reject(event.target.error);
    };
  });
}
