export interface Diary {
  id?: string;
  title: string;
  content: string;
  createdAt: string;
  isLocalOnly?: boolean;
}

export interface MeaningUnit {
  id?: string;
  diaryId: string;
  nativeText: string;
  englishPivot: string;
  order: number;
  specialty?: string;
  subSpecialty?: string;
}

export interface SemanticGroup {
  id?: string;
  canonicalMeaning: string; // The primary concept/meaning in English (the Pivot)
  coverageLevel: number; // Represents how heavily studied this group is (number of chunks or calculated rating)
  createdAt: string;
}

export interface Chunk {
  id?: string;
  meaningUnitId: string;
  semanticGroupId?: string; // Links this chunk to a SemanticGroup in the library
  language: string;
  text: string;
  meaning: string; // Translation in English
  ipa: string;
  romanization: string;
  chunkType: "common" | "personalized";
  stars: number;
  bestAccuracy: number;
  timesPracticed: number;
  lastPracticed: string;
  totalReviews: number;
  averageRating: number;
  lastRating: number;
  lastReviewed: string;
  sourceDiaryId: string;
  sourceDiaryTitle: string;
  specialty?: string;
  subSpecialty?: string;
  domainTags?: string[];
  packageId?: string;
  isPurchasedPackage?: boolean;
  syncStatus?: "synced" | "pending_sync";
  updatedAt?: string;
}

/**
 * Single source of truth for harvested English Chunks tagged with domain/specialty.
 * Used by englishChunkDb.ts for deduplication, merging datasets, and commercial packaging.
 */
export interface EnglishChunk {
  id: string;
  text: string;                  // English text (e.g., "fix the bug")
  meaning: string;               // Native translation (e.g., "sửa lỗi phần mềm")
  ipa: string;                   // Phonetic IPA
  chunkType: "common" | "personalized";
  specialty?: string;            // e.g., "Công nghệ thông tin"
  subSpecialty?: string;         // e.g., "Backend Development"
  domainTags?: string[];         // e.g., ["git", "debugging"]
  packageId?: string;            // e.g., "pack-it-engineer-3000"
  createdAt: string;
  updatedAt: string;
}

/**
 * User personal learning record for backup and device restore.
 * Contains native language context, target chunk, and practice stats.
 */
export interface UserTargetChunkProgress {
  id: string;
  userId?: string;
  nativeText: string;            // Native language sentence
  targetLanguage: string;        // e.g., "Chinese" or "English"
  targetChunkText: string;       // e.g., "早上好" or "Good morning"
  targetMeaning: string;         // Translation in native language
  ipaOrPinyin: string;           // Phonetic IPA or Pinyin
  chunkType: "common" | "personalized";
  specialty?: string;
  subSpecialty?: string;
  stars: number;
  bestAccuracy: number;
  timesPracticed: number;
  lastPracticed: string;
  totalReviews: number;
  averageRating: number;
  lastRating: number;
  lastReviewed: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: "synced" | "pending_sync";
}

export interface PurchasedPackage {
  packageId: string;             // e.g., "pack-it-engineer-3000"
  title: string;                 // e.g., "Gói 3,000 Chunks Tiếng Anh Cho Kỹ Sư IT"
  specialty: string;             // "Công nghệ thông tin"
  totalChunks: number;
  purchasedAt: string;
}

export interface UserSettings {
  nickname?: string;
  nativeLanguage: string;
  learningLanguages: string[];
  hobby?: string;
  learningPurpose?: "hobby" | "work";
  specialty?: string;
  subSpecialty?: string;
  cefrLevel?: string;
  onboarded?: boolean;
}

export interface GenerationStep {
  name: string;
  status: "idle" | "running" | "done" | "error";
  description: string;
}

