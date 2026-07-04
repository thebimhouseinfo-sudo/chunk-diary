export interface Diary {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface MeaningUnit {
  id: string;
  diaryId: string;
  nativeText: string;
  englishPivot: string;
  order: number;
}

export interface Chunk {
  id: string;
  meaningUnitId: string;
  language: string;
  text: string;
  meaning: string;
  ipa: string;
  romanization: string;
  stars: number; // 0 for unpracticed, 1-5 for practiced
  bestAccuracy: number;
  timesPracticed: number;
  lastPracticed: string;
  sourceDiaryId: string;
  sourceDiaryTitle: string;
}

export interface PracticeHistory {
  id: string;
  chunkId: string;
  date: string;
  accuracy: number;
  stars: number;
}

export interface UserSettings {
  nativeLanguage: string;
  learningLanguages: string[]; // max 3
  aiProvider: "gemini" | "openai" | "xai";
  apiKey: string;
  modelPriorityList: {
    gemini: string[];
    openai: string[];
    xai: string[];
  };
  onboardingComplete?: boolean;
  nickname?: string;
  learningPurposes?: string[]; // Multiple choice: "Sở thích" | "Công việc" | "Khác"
  industryCategory?: string;
  industry?: string;
  hobbyCategory?: string;
  hobby?: string;
}

export interface GenerationStep {
  name: string;
  status: "idle" | "running" | "done" | "error";
  description: string;
}
