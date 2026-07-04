import { Diary, MeaningUnit, Chunk, PracticeHistory, UserSettings } from "../types";

const DB_NAME = "LanguageChunkDiaryDB";
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains("diaries")) {
        db.createObjectStore("diaries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meaningUnits")) {
        const store = db.createObjectStore("meaningUnits", { keyPath: "id" });
        store.createIndex("diaryId", "diaryId", { unique: false });
      }
      if (!db.objectStoreNames.contains("chunks")) {
        const store = db.createObjectStore("chunks", { keyPath: "id" });
        store.createIndex("meaningUnitId", "meaningUnitId", { unique: false });
        store.createIndex("sourceDiaryId", "sourceDiaryId", { unique: false });
      }
      if (!db.objectStoreNames.contains("history")) {
        const store = db.createObjectStore("history", { keyPath: "id" });
        store.createIndex("chunkId", "chunkId", { unique: false });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
  });
}

// Settings helpers
const DEFAULT_SETTINGS: UserSettings = {
  nativeLanguage: "Vietnamese",
  learningLanguages: ["English", "Japanese", "Chinese"],
  aiProvider: "gemini",
  apiKey: "",
  modelPriorityList: {
    gemini: ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"],
    openai: ["gpt-4o-mini", "gpt-4o"],
    xai: ["grok-2-1212", "grok-2-mini"]
  },
  onboardingComplete: false,
  nickname: "",
  learningPurposes: [],
  industryCategory: "",
  industry: "",
  hobbyCategory: "",
  hobby: ""
};

export async function getSettings(): Promise<UserSettings> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readonly");
    const store = transaction.objectStore("settings");
    const request = store.get("userConfig");

    request.onsuccess = () => {
      if (request.result) {
        // Merge defaults in case new fields are added
        resolve({ ...DEFAULT_SETTINGS, ...request.result.value });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    };
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

// Diary helpers
export async function getDiaries(): Promise<Diary[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("diaries", "readonly");
    const store = transaction.objectStore("diaries");
    const request = store.getAll();

    request.onsuccess = () => {
      const list = request.result as Diary[];
      // Sort by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveDiary(diary: Diary): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("diaries", "readwrite");
    const store = transaction.objectStore("diaries");
    const request = store.put(diary);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDiary(diaryId: string): Promise<void> {
  const db = await openDB();
  
  // Also delete associated meaning units and chunks
  const mus = await getMeaningUnitsForDiary(diaryId);
  const chunks = await getChunks();
  const chunkIdsToDelete = chunks.filter(c => c.sourceDiaryId === diaryId).map(c => c.id);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["diaries", "meaningUnits", "chunks"], "readwrite");
    
    // Delete diary
    transaction.objectStore("diaries").delete(diaryId);
    
    // Delete meaning units
    const muStore = transaction.objectStore("meaningUnits");
    mus.forEach(mu => muStore.delete(mu.id));
    
    // Delete chunks
    const chunkStore = transaction.objectStore("chunks");
    chunkIdsToDelete.forEach(cid => chunkStore.delete(cid));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// MeaningUnit helpers
export async function getMeaningUnitsForDiary(diaryId: string): Promise<MeaningUnit[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meaningUnits", "readonly");
    const store = transaction.objectStore("meaningUnits");
    const index = store.index("diaryId");
    const request = index.getAll(diaryId);

    request.onsuccess = () => {
      const list = request.result as MeaningUnit[];
      list.sort((a, b) => a.order - b.order);
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveMeaningUnits(units: MeaningUnit[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meaningUnits", "readwrite");
    const store = transaction.objectStore("meaningUnits");
    
    units.forEach(unit => {
      store.put(unit);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Chunk helpers
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

export async function saveChunks(chunks: Chunk[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    
    chunks.forEach(chunk => {
      store.put(chunk);
    });

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

// History helpers
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

// Clear DB for resets if needed
export async function clearAllData(): Promise<void> {
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

// Pre-populate Database with friendly welcoming data if empty
export async function preseedDatabaseIfEmpty(): Promise<void> {
  const diaries = await getDiaries();
  if (diaries.length > 0) return; // Already seeded

  console.log("Seeding database with default welcome data...");

  const welcomeDiaryId = "welcome-diary";
  
  const welcomeDiary: Diary = {
    id: welcomeDiaryId,
    title: "Nhật ký Chào Mừng! (Welcome Diary)",
    content: "Hôm nay tôi bắt đầu học một ngoại ngữ mới. Tôi sẽ viết nhật ký mỗi ngày để học cách diễn đạt tự nhiên hơn.",
    createdAt: new Date().toISOString()
  };

  const mu1: MeaningUnit = {
    id: "welcome-mu-1",
    diaryId: welcomeDiaryId,
    nativeText: "Hôm nay tôi bắt đầu học một ngoại ngữ mới.",
    englishPivot: "Today I start learning a new foreign language.",
    order: 1
  };

  const mu2: MeaningUnit = {
    id: "welcome-mu-2",
    diaryId: welcomeDiaryId,
    nativeText: "Tôi sẽ viết nhật ký mỗi ngày để học cách diễn đạt tự nhiên hơn.",
    englishPivot: "I will write a diary every day to learn how to express myself more naturally.",
    order: 2
  };

  const c1: Chunk = {
    id: "welcome-chunk-1",
    meaningUnitId: mu1.id,
    language: "English",
    text: "learning a new foreign language",
    meaning: "học một ngoại ngữ mới",
    ipa: "/ˈlɜːrnɪŋ ə njuː ˈfɔːrən ˈlæŋɡwɪdʒ/",
    romanization: "",
    stars: 0,
    bestAccuracy: 0,
    timesPracticed: 0,
    lastPracticed: "",
    sourceDiaryId: welcomeDiaryId,
    sourceDiaryTitle: welcomeDiary.title
  };

  const c2: Chunk = {
    id: "welcome-chunk-2",
    meaningUnitId: mu1.id,
    language: "Japanese",
    text: "新しい外国語を学び始める",
    meaning: "bắt đầu học một ngoại ngữ mới",
    ipa: "/ataɾaɕiː ɡaikokɯɡo o manabi haʑimeɾɯ/",
    romanization: "A-ta-ra-shi-i · gai-ko-ku-go · o · ma-na-bi · ha-ji-me-ru",
    stars: 0,
    bestAccuracy: 0,
    timesPracticed: 0,
    lastPracticed: "",
    sourceDiaryId: welcomeDiaryId,
    sourceDiaryTitle: welcomeDiary.title
  };

  const c3: Chunk = {
    id: "welcome-chunk-3",
    meaningUnitId: mu1.id,
    language: "Chinese",
    text: "开始学习一门新的外语",
    meaning: "bắt đầu học một ngoại ngữ mới",
    ipa: "/kʰaɪ̯⁵⁵ ʂʐ̩³⁵ ɕɥɛ³⁵ ɕi³⁵ i⁵⁵ mən³⁵ ɕɪn⁵⁵ waɪ̯⁵¹ y³¹/",
    romanization: "kāi-shǐ · xué-xí · yī-mén · xīn-de · wài-yǔ",
    stars: 0,
    bestAccuracy: 0,
    timesPracticed: 0,
    lastPracticed: "",
    sourceDiaryId: welcomeDiaryId,
    sourceDiaryTitle: welcomeDiary.title
  };

  const c4: Chunk = {
    id: "welcome-chunk-4",
    meaningUnitId: mu2.id,
    language: "English",
    text: "write a diary every day",
    meaning: "viết nhật ký mỗi ngày",
    ipa: "/raɪt ə ˈdaɪəri ˈɛvri deɪ/",
    romanization: "",
    stars: 0,
    bestAccuracy: 0,
    timesPracticed: 0,
    lastPracticed: "",
    sourceDiaryId: welcomeDiaryId,
    sourceDiaryTitle: welcomeDiary.title
  };

  const c5: Chunk = {
    id: "welcome-chunk-5",
    meaningUnitId: mu2.id,
    language: "Japanese",
    text: "毎日日記を書く",
    meaning: "viết nhật ký hàng ngày",
    ipa: "/maĩɲit͡ɕi ɲikkʲi o kakɯ/",
    romanization: "Mai-ni-chi · nik-ki · o · ka-ku",
    stars: 0,
    bestAccuracy: 0,
    timesPracticed: 0,
    lastPracticed: "",
    sourceDiaryId: welcomeDiaryId,
    sourceDiaryTitle: welcomeDiary.title
  };

  await saveDiary(welcomeDiary);
  await saveMeaningUnits([mu1, mu2]);
  await saveChunks([c1, c2, c3, c4, c5]);
  console.log("Pre-seeding completed successfully!");
}
