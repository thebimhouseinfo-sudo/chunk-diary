/**
 * M2: language-neutral registry. BCP-47 is the persisted canonical identifier.
 * Product labels from beta stay acceptable inputs; do not mutate legacy rows.
 * Pronunciation guidance is metadata, not a claim of acoustic accuracy.
 */
export type PhoneticSystem = "ipa" | "pinyin" | "kana" | "hangul" | "none";
export type Tokenization = "word" | "cjk" | "japanese" | "korean";
export interface LanguageProfile {
  locale: string;
  baseLanguage: string;
  label: string;
  nativeLabel: string;
  phonetics: PhoneticSystem;
  tokenization: Tokenization;
  levels: "CEFR" | "HSK" | "JLPT" | "TOPIK" | "NONE";
}

export const LANGUAGE_PROFILES: readonly LanguageProfile[] = [
  { locale: "vi-VN", baseLanguage: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt", phonetics: "ipa", tokenization: "word", levels: "CEFR" },
  { locale: "en-US", baseLanguage: "en", label: "English", nativeLabel: "English", phonetics: "ipa", tokenization: "word", levels: "CEFR" },
  { locale: "zh-CN", baseLanguage: "zh", label: "Chinese", nativeLabel: "简体中文", phonetics: "pinyin", tokenization: "cjk", levels: "HSK" },
  { locale: "ja-JP", baseLanguage: "ja", label: "Japanese", nativeLabel: "日本語", phonetics: "kana", tokenization: "japanese", levels: "JLPT" },
  { locale: "ko-KR", baseLanguage: "ko", label: "Korean", nativeLabel: "한국어", phonetics: "hangul", tokenization: "korean", levels: "TOPIK" },
  { locale: "es-ES", baseLanguage: "es", label: "Spanish", nativeLabel: "Español", phonetics: "ipa", tokenization: "word", levels: "CEFR" },
  { locale: "fr-FR", baseLanguage: "fr", label: "French", nativeLabel: "Français", phonetics: "ipa", tokenization: "word", levels: "CEFR" },
] as const;

const legacyAliases: Record<string, string> = {
  en: "en-US", english: "en-US",
  vi: "vi-VN", vietnamese: "vi-VN", "tiếng việt": "vi-VN",
  zh: "zh-CN", cn: "zh-CN", chinese: "zh-CN", mandarin: "zh-CN",
  ja: "ja-JP", jp: "ja-JP", japanese: "ja-JP",
  ko: "ko-KR", kr: "ko-KR", korean: "ko-KR",
  es: "es-ES", spanish: "es-ES",
  fr: "fr-FR", french: "fr-FR",
};

export function canonicalLanguageTag(input: string): string {
  const trimmed = input?.trim();
  if (!trimmed) throw new Error("Language is required");
  const alias = legacyAliases[trimmed.toLocaleLowerCase("en")] ?? trimmed.replace(/_/g, "-");
  let canonical: string;
  try { canonical = Intl.getCanonicalLocales(alias)[0]; }
  catch { throw new Error("Unsupported language tag"); }
  if (!canonical || !/^[a-z]{2,3}(-|$)/i.test(canonical)) throw new Error("Invalid language tag");
  return canonical;
}

export function getLanguageProfile(input: string): LanguageProfile {
  const tag = canonicalLanguageTag(input);
  const base = tag.split("-")[0].toLowerCase();
  const known = LANGUAGE_PROFILES.find((profile) => profile.baseLanguage === base);
  if (!known) throw new Error("Language is not supported by the current Web app: " + tag);
  return { ...known, locale: tag };
}

export function sameLanguage(a: string, b: string): boolean {
  return getLanguageProfile(a).baseLanguage === getLanguageProfile(b).baseLanguage;
}

export function normalizeLearningText(text: string, language: string): string {
  const tag = getLanguageProfile(language).locale;
  return text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(tag);
}

export function tokenizeLearningText(text: string, language: string): string[] {
  const profile = getLanguageProfile(language);
  if (!text.trim()) return [];
  const Seg = Intl.Segmenter;
  if (typeof Seg === "function") {
    const segmenter = new Seg(profile.locale, { granularity: "word" });
    return [...segmenter.segment(text)].filter((entry) => entry.isWordLike).map((entry) => entry.segment);
  }
  if (profile.tokenization === "word") return text.match(/[\p{L}\p{N}]+/gu) ?? [];
  // Fallback is Unicode-codepoint based rather than pretending CJK uses spaces.
  return Array.from(text).filter((letter) => /[\p{L}\p{N}]/u.test(letter));
}
