import { Diary, MeaningUnit, Chunk, UserSettings, SemanticGroup } from "../types";
import { getSettings, saveSettings } from "./userDb";

// Re-export settings APIs for backward compatibility and centralized imports
export { getSettings, saveSettings };

const DB_NAME = "LanguageChunkDiaryDB";
const DB_VERSION = 4;

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
      if (!db.objectStoreNames.contains("englishChunks")) {
        const engStore = db.createObjectStore("englishChunks", { keyPath: "id" });
        engStore.createIndex("specialty", "specialty", { unique: false });
        engStore.createIndex("packageId", "packageId", { unique: false });
      }
      if (!db.objectStoreNames.contains("userProgress")) {
        const progStore = db.createObjectStore("userProgress", { keyPath: "id" });
        progStore.createIndex("userId", "userId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
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
  let mus: MeaningUnit[] = [];
  try {
    mus = await getMeaningUnitsForDiary(diaryId);
  } catch (err) {
    console.warn("Failed to get meaning units for deletion:", err);
  }

  let chunkIdsToDelete: string[] = [];
  try {
    const chunks = await getChunks();
    chunkIdsToDelete = chunks.filter(c => c.sourceDiaryId === diaryId).map(c => c.id).filter((id): id is string => !!id);
  } catch (err) {
    console.warn("Failed to get chunks for deletion:", err);
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(["diaries", "meaningUnits", "chunks"], "readwrite");
      
      const diaryStore = transaction.objectStore("diaries");
      diaryStore.delete(diaryId);
      
      const muStore = transaction.objectStore("meaningUnits");
      mus.forEach(mu => {
        if (mu.id) muStore.delete(mu.id);
      });
      
      const chunkStore = transaction.objectStore("chunks");
      chunkIdsToDelete.forEach(cid => {
        chunkStore.delete(cid);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (err) {
      reject(err);
    }
  });
}

// MeaningUnit
export async function getMeaningUnitsForDiary(diaryId: string): Promise<MeaningUnit[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meaningUnits", "readonly");
    const store = transaction.objectStore("meaningUnits");
    if (!store.indexNames.contains("diaryId")) {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as MeaningUnit[];
        const filtered = all.filter(u => u.diaryId === diaryId);
        filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
      return;
    }
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
    if (!store.indexNames.contains("meaningUnitId")) {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as Chunk[];
        resolve(all.filter(c => c.meaningUnitId === muId));
      };
      request.onerror = () => reject(request.error);
      return;
    }
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

export async function updateChunkReviewStats(chunkId: string, rating: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    const getRequest = store.get(chunkId);

    getRequest.onsuccess = () => {
      const chunk = getRequest.result as Chunk | undefined;
      if (chunk) {
        chunk.timesPracticed = (chunk.timesPracticed || 0) + 1;
        chunk.lastPracticed = new Date().toISOString();
        chunk.lastReviewed = chunk.lastPracticed;
        
        const oldTotal = chunk.totalReviews || 0;
        const newTotal = oldTotal + 1;
        chunk.totalReviews = newTotal;
        chunk.lastRating = rating;
        chunk.stars = Math.round(rating);

        const oldAverage = chunk.averageRating || 0;
        chunk.averageRating = Number(((oldAverage * oldTotal + rating) / newTotal).toFixed(2));

        const putRequest = store.put(chunk);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

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

export async function getChunksBySemanticGroupId(groupId: string): Promise<Chunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readonly");
    const store = transaction.objectStore("chunks");
    if (!store.indexNames.contains("semanticGroupId")) {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as Chunk[];
        resolve(all.filter(c => c.semanticGroupId === groupId));
      };
      request.onerror = () => reject(request.error);
      return;
    }
    const index = store.index("semanticGroupId");
    const request = index.getAll(groupId);
    request.onsuccess = () => resolve(request.result as Chunk[]);
    request.onerror = () => reject(request.error);
  });
}

export async function preseedDatabaseIfEmpty(): Promise<void> {
  const db = await openDB();
  // Check if diaries are empty
  const diaries = await getDiaries();
  if (diaries.length > 0) return;

  const defaultDiaryId = crypto.randomUUID();
  await saveDiary({
    id: defaultDiaryId,
    title: "Chào mừng bạn đến với ChunkDiary!",
    content: "Chào mừng bạn đã tham gia hành trình học ngôn ngữ tự nhiên thông qua các chunks.",
    createdAt: new Date().toISOString()
  });

  const muId = await saveMeaningUnit({
    diaryId: defaultDiaryId,
    nativeText: "Chào mừng bạn đến với ChunkDiary!",
    englishPivot: "Welcome to ChunkDiary!",
    order: 0
  });

  await saveChunk({
    meaningUnitId: muId,
    semanticGroupId: "welcome-group-1",
    language: "English",
    text: "Welcome to",
    meaning: "Chào mừng bạn đến với",
    ipa: "/ˈwɛl.kəm tuː/",
    romanization: "",
    chunkType: "common",
    stars: 0,
    bestAccuracy: 0,
    timesPracticed: 0,
    lastPracticed: "",
    totalReviews: 0,
    averageRating: 0,
    lastRating: 0,
    lastReviewed: "",
    sourceDiaryId: defaultDiaryId,
    sourceDiaryTitle: "Chào mừng bạn đến với ChunkDiary!"
  });
}

export async function clearAllIndexedDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      console.log("IndexedDB cleared successfully.");
      // After deleting, we need to reopen it to re-create object stores for future use
      openDB().then(() => resolve()).catch(reject);
    };

    request.onerror = (event: any) => {
      console.error("Error clearing IndexedDB:", event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.warn("IndexedDB clear blocked. Close all connections to the database.");
      reject(new Error("IndexedDB clear blocked"));
    };
  });
}
