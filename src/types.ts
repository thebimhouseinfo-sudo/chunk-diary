export interface Diary {
  id?: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface MeaningUnit {
  id?: string;
  diaryId: string;
  nativeText: string;
  englishPivot: string;
  order: number;
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
