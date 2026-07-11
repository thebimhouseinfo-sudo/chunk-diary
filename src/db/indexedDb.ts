import { Diary, MeaningUnit, Chunk, UserSettings, SemanticGroup } from "../types";

const DB_NAME = "LanguageChunkDiaryDB";
const DB_VERSION = 2;

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
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
        chunkStore.createIndex("semanticGroupId", "semanticGroupId", { unique: false });
      } else {
        const transaction = request.transaction;
        if (transaction) {
          const chunkStore = transaction.objectStore("chunks");
          if (!chunkStore.indexNames.contains("semanticGroupId")) {
            chunkStore.createIndex("semanticGroupId", "semanticGroupId", { unique: false });
          }
        }
      }
      if (!db.objectStoreNames.contains("semanticGroups")) {
        db.createObjectStore("semanticGroups", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
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

export async function updateChunkReviewStats(id: string, rating: number): Promise<Chunk> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const chunk = getRequest.result as Chunk;
      if (chunk) {
        const oldReviews = chunk.totalReviews || 0;
        const oldAverage = chunk.averageRating || 0;
        
        chunk.totalReviews = oldReviews + 1;
        chunk.averageRating = ((oldAverage * oldReviews) + rating) / chunk.totalReviews;
        chunk.lastRating = rating;
        chunk.lastReviewed = new Date().toISOString();
        
        // Keep old fields in sync just in case
        chunk.timesPracticed = chunk.totalReviews;
        chunk.stars = Math.round(chunk.averageRating);
        chunk.lastPracticed = chunk.lastReviewed;

        store.put(chunk);
        resolve(chunk);
      } else {
        reject(new Error("Chunk not found"));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
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

export async function clearDatabase(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["diaries", "meaningUnits", "chunks", "semanticGroups"], "readwrite");
    transaction.objectStore("diaries").clear();
    transaction.objectStore("meaningUnits").clear();
    transaction.objectStore("chunks").clear();
    transaction.objectStore("semanticGroups").clear();
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

// SemanticGroups
export async function getSemanticGroups(): Promise<SemanticGroup[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("semanticGroups", "readonly");
    const store = transaction.objectStore("semanticGroups");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as SemanticGroup[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSemanticGroup(group: SemanticGroup): Promise<string> {
  const db = await openDB();
  if (!group.id) group.id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("semanticGroups", "readwrite");
    const store = transaction.objectStore("semanticGroups");
    const request = store.put(group);
    request.onsuccess = () => resolve(group.id!);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSemanticGroup(groupId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["semanticGroups", "chunks"], "readwrite");
    
    // Delete the group
    transaction.objectStore("semanticGroups").delete(groupId);
    
    // Set semanticGroupId to empty/undefined on all chunks in that group
    const chunkStore = transaction.objectStore("chunks");
    const index = chunkStore.index("semanticGroupId");
    const request = index.openCursor(groupId);
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const chunk = cursor.value as Chunk;
        chunk.semanticGroupId = undefined;
        cursor.update(chunk);
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getChunksBySemanticGroupId(groupId: string): Promise<Chunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readonly");
    const store = transaction.objectStore("chunks");
    const index = store.index("semanticGroupId");
    const request = index.getAll(groupId);
    request.onsuccess = () => resolve(request.result as Chunk[]);
    request.onerror = () => reject(request.error);
  });
}

