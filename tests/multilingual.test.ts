import test from "node:test";
import assert from "node:assert/strict";
import {
  LANGUAGE_PROFILES, canonicalLanguageTag, getLanguageProfile,
  sameLanguage, normalizeLearningText, tokenizeLearningText,
} from "../src/domain/language.ts";
import { validateGeneratedResponse } from "../src/domain/generation.ts";

test("M2 profiles: BCP-47 aliases, five target languages and legacy names", () => {
  for (const language of ["en", "zh", "ja", "ko", "es", "vi"]) {
    assert.ok(getLanguageProfile(language).locale, language);
  }
  assert.ok(LANGUAGE_PROFILES.length >= 6);
  assert.equal(canonicalLanguageTag("chinese"), "zh-CN");
  assert.equal(canonicalLanguageTag("EN_us"), "en-US");
  assert.equal(canonicalLanguageTag("japanese"), "ja-JP");
  assert.equal(canonicalLanguageTag("Korean"), "ko-KR");
  assert.equal(canonicalLanguageTag("Spanish"), "es-ES");
  assert.equal(sameLanguage("en", "en-GB"), true);
  assert.equal(sameLanguage("zh-CN", "ko-KR"), false);
  assert.throws(() => getLanguageProfile("xx-XX"), /not supported/);
  assert.throws(() => canonicalLanguageTag("not a language??"), /Unsupported/);
});

test("M2 tokenize locale-aware CJK, Japanese, Korean and Latin without English pivot", () => {
  const phrases = [
    ["zh-CN", "我今天学习中文"],
    ["ja-JP", "今日は日本語を勉強します"],
    ["ko-KR", "오늘 한국어를 공부합니다"],
    ["en-US", "I study English today"],
    ["es-ES", "Aprendo español hoy"],
  ] as const;
  for (const [locale, value] of phrases) {
    const tokens = tokenizeLearningText(value, locale);
    assert.ok(tokens.length > 0, locale);
    assert.ok(tokens.every((v) => v.length > 0), locale);
  }
  assert.equal(normalizeLearningText("  GOOD  Morning  ", "English"), "good morning");
});

test("M2 v2 Japanese response requires zero English fields and validates one + one chunks", () => {
  const raw = {
    contractVersion: "2",
    sourceLanguage: "vi",
    targetLanguage: "ja-JP",
    narrative: "今日は少し遅く起きました。",
    semanticUnits: [{
      order: 1,
      sourceText: "Hôm nay tôi dậy muộn.",
      commonChunks: [{
        targetText: "寝坊しました", meaning: "đã ngủ quên",
        romanization: "nebou shimashita",
        proposedCanonicalMeaning: "ngủ quên",
      }],
      personalizedChunks: [{
        targetText: "今日は遅く起きました", meaning: "hôm nay tôi dậy muộn",
        proposedCanonicalMeaning: "thức dậy muộn",
      }],
    }],
  };
  const parsed = validateGeneratedResponse(raw);
  assert.equal(parsed.contractVersion, "2");
  assert.equal(parsed.targetLanguage, "ja-JP");
  assert.equal(parsed.semanticUnits[0].englishText, undefined);
  assert.equal(parsed.englishNarrative, undefined);
  assert.equal(parsed.semanticUnits[0].nativeText, "Hôm nay tôi dậy muộn.");
  assert.equal(parsed.semanticUnits[0].commonChunks[0].text, "寝坊しました");
  assert.equal(parsed.semanticUnits[0].commonChunks[0].english, undefined);
  assert.equal(parsed.semanticUnits[0].commonChunks.length, 1);
  assert.equal(parsed.semanticUnits[0].personalizedChunks.length, 1);
});

test("M2 backward compatibility: legacy v1 response preserves genuine English pivot", () => {
  const raw = {
    englishNarrative: "I got up late.",
    semanticUnits: [{
      order: 1, nativeText: "Tôi dậy muộn", englishText: "I got up late",
      commonChunks: [{ english: "get up late", text: "get up late", meaning: "dậy muộn",
        ipa: "/ɡet ʌp leɪt/", romanization: "", semanticGroupId: "old-group" }],
      personalizedChunks: [],
    }],
  };
  const parsed = validateGeneratedResponse(raw, "Vietnamese", "English");
  assert.equal(parsed.contractVersion, "1");
  assert.equal(parsed.englishNarrative, raw.englishNarrative);
  assert.equal(parsed.semanticUnits[0].englishText, "I got up late");
  assert.equal(parsed.semanticUnits[0].commonChunks[0].english, "get up late");
});

test("NEGATIVE CONTROL M2: duplicate order, invented extra chunks or absent group evidence reject fully", () => {
  const base = {
    contractVersion: "2", sourceLanguage: "vi", targetLanguage: "zh-CN",
    semanticUnits: [{ order: 1, sourceText: "Tôi uống trà.",
      commonChunks: [{ targetText: "喝茶", meaning: "uống trà", proposedCanonicalMeaning: "uống trà" }],
      personalizedChunks: [] }],
  };
  const twice = structuredClone(base);
  twice.semanticUnits.push(structuredClone(twice.semanticUnits[0]));
  assert.throws(() => validateGeneratedResponse(twice), /order must be unique/);
  const extra = structuredClone(base);
  extra.semanticUnits[0].commonChunks.push(structuredClone(extra.semanticUnits[0].commonChunks[0]));
  assert.throws(() => validateGeneratedResponse(extra), /at most one chunk/);
  const noGroup = structuredClone(base);
  noGroup.semanticUnits[0].commonChunks[0].proposedCanonicalMeaning = "";
  assert.throws(() => validateGeneratedResponse(noGroup), /requires semanticGroupId/);
  const unsupported = { ...base, contractVersion: "9" };
  assert.throws(() => validateGeneratedResponse(unsupported), /Unsupported AI contract/);
  const emptySource = structuredClone(base);
  emptySource.semanticUnits[0].sourceText = " ";
  assert.throws(() => validateGeneratedResponse(emptySource), /nonempty/);
});

test("NEGATIVE CONTROL M2: invalid language tags and output size are rejected", () => {
  const raw = {
    contractVersion: "2", sourceLanguage: "vi", targetLanguage: "Japanese",
    semanticUnits: [{ order: 1, sourceText: "Đọc sách", commonChunks: [],
      personalizedChunks: [] }],
  };
  assert.equal(validateGeneratedResponse(raw).targetLanguage, "ja-JP");
  assert.throws(() => validateGeneratedResponse(raw, "vi", "xx"), /not supported/);
  const long = structuredClone(raw);
  long.semanticUnits[0].sourceText = "X".repeat(12001);
  assert.throws(() => validateGeneratedResponse(long), /length limit/);
});
