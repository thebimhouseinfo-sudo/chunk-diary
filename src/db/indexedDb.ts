import { Diary, MeaningUnit, Chunk, UserSettings, PracticeHistory } from "../types";

const DB_NAME = "LanguageChunkDiaryDB";
const DB_VERSION = 1;

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("diaries")) {
        db.createObjectStore("diaries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meaningUnits")) {
        const muStore = db.createObjectStore("meaningUnits", { keyPath: "id" });
        muStore.createIndex("diaryId", "diaryId", { unique: false });
      }
      if (!db.objectStoreNames.contains("chunks")) {
        const chunkStore = db.createObjectStore("chunks", { keyPath: "id" });
        chunkStore.createIndex("meaningUnitId", "meaningUnitId", { unique: false });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("history")) {
        db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Settings
export async function getSettings(): Promise<UserSettings | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readonly");
    const store = transaction.objectStore("settings");
    const request = store.get("userConfig");
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");
    const request = store.put({ key: "userConfig", value: settings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Diary
export async function getDiaries(): Promise<Diary[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("diaries", "readonly");
    const store = transaction.objectStore("diaries");
    const request = store.getAll();
    request.onsuccess = () => {
      const list = request.result as Diary[];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveDiary(diary: Diary): Promise<string> {
  const db = await openDB();
  if (!diary.id) diary.id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("diaries", "readwrite");
    const store = transaction.objectStore("diaries");
    const request = store.put(diary);
    request.onsuccess = () => resolve(diary.id!);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDiary(diaryId: string): Promise<void> {
  const db = await openDB();
  const mus = await getMeaningUnitsForDiary(diaryId);
  const chunks = await getChunks();
  const chunkIdsToDelete = chunks.filter(c => c.sourceDiaryId === diaryId).map(c => c.id);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["diaries", "meaningUnits", "chunks"], "readwrite");
    transaction.objectStore("diaries").delete(diaryId);
    const muStore = transaction.objectStore("meaningUnits");
    mus.forEach(mu => muStore.delete(mu.id!));
    const chunkStore = transaction.objectStore("chunks");
    chunkIdsToDelete.forEach(cid => chunkStore.delete(cid!));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// MeaningUnit
export async function getMeaningUnitsForDiary(diaryId: string): Promise<MeaningUnit[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meaningUnits", "readonly");
    const store = transaction.objectStore("meaningUnits");
    const index = store.index("diaryId");
    const request = index.getAll(diaryId);
    request.onsuccess = () => {
      const list = request.result as MeaningUnit[];
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveMeaningUnit(unit: MeaningUnit): Promise<string> {
  const db = await openDB();
  if (!unit.id) unit.id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meaningUnits", "readwrite");
    const store = transaction.objectStore("meaningUnits");
    const request = store.put(unit);
    request.onsuccess = () => resolve(unit.id!);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMeaningUnits(units: MeaningUnit[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meaningUnits", "readwrite");
    const store = transaction.objectStore("meaningUnits");
    units.forEach(u => store.put(u));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Chunk
export async function getChunks(): Promise<Chunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readonly");
    const store = transaction.objectStore("chunks");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Chunk[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getChunksByMeaningUnitId(muId: string): Promise<Chunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readonly");
    const store = transaction.objectStore("chunks");
    const index = store.index("meaningUnitId");
    const request = index.getAll(muId);
    request.onsuccess = () => resolve(request.result as Chunk[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChunk(chunk: Chunk): Promise<string> {
  const db = await openDB();
  if (!chunk.id) chunk.id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    const request = store.put(chunk);
    request.onsuccess = () => resolve(chunk.id!);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChunks(chunks: Chunk[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    chunks.forEach(c => store.put(c));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function updateChunk(chunk: Chunk): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    const request = store.put(chunk);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateChunkStats(id: string, accuracy: number, stars: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const chunk = getRequest.result as Chunk;
      if (chunk) {
        chunk.timesPracticed = (chunk.timesPracticed || 0) + 1;
        if (accuracy > (chunk.bestAccuracy || 0)) chunk.bestAccuracy = accuracy;
        if (stars > (chunk.stars || 0)) chunk.stars = stars;
        chunk.lastPracticed = new Date().toISOString();
        store.put(chunk);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteChunk(chunkId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    const request = store.delete(chunkId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// History
export async function getHistory(): Promise<PracticeHistory[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("history", "readonly");
    const store = transaction.objectStore("history");
    const request = store.getAll();
    request.onsuccess = () => {
      const list = request.result as PracticeHistory[];
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addHistory(item: PracticeHistory): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("history", "readwrite");
    const store = transaction.objectStore("history");
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearDatabase(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["diaries", "meaningUnits", "chunks", "history"], "readwrite");
    transaction.objectStore("diaries").clear();
    transaction.objectStore("meaningUnits").clear();
    transaction.objectStore("chunks").clear();
    transaction.objectStore("history").clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function preseedDatabaseIfEmpty(): Promise<void> {
  const diaries = await getDiaries();
  if (diaries.length > 0) return;

  const welcomeDiaryId = crypto.randomUUID();
  const welcomeDiary: Diary = {
    id: welcomeDiaryId,
    title: "Chào mừng bạn đến với ChunkDiary!",
    content: "Đây là ví dụ đầu tiên. Hãy bắt đầu hành trình học ngoại ngữ bằng cách viết nhật ký mỗi ngày.",
    createdAt: new Date().toISOString()
  };

  await saveDiary(welcomeDiary);
}
