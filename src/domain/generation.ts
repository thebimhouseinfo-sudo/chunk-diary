import { getLanguageProfile } from "./language";

/**
 * Pure, provider-agnostic M2 response validator. V2 never requires English
 * translation. English-only metadata is accepted from beta v1 but not invented.
 */
export const GENERATION_CONTRACT_VERSION = "2";
export const MAX_SEMANTIC_UNITS = 40;
export const MAX_CHUNKS_PER_TYPE = 1;
const MAX_FIELD_LENGTH = 12000;

export interface GeneratedChunk {
  text: string;
  meaning: string;
  ipa: string;
  romanization: string;
  english?: string;
  semanticGroupId: string;
  proposedCanonicalMeaning?: string;
}

export interface GeneratedSemanticUnit {
  order: number;
  nativeText: string;
  sourceText: string;
  englishText?: string;
  commonChunks: GeneratedChunk[];
  personalizedChunks: GeneratedChunk[];
}
export interface GeneratedResponse {
  contractVersion: "1" | "2";
  sourceLanguage?: string;
  targetLanguage?: string;
  englishNarrative?: string;
  narrative?: string;
  semanticUnits: GeneratedSemanticUnit[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_FIELD_LENGTH) {
    throw new Error(label + " must be nonempty text within length limit");
  }
  return value.trim();
}
function optional(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.length > MAX_FIELD_LENGTH) {
    throw new Error(label + " must be a string");
  }
  return value.trim() || undefined;
}
function chunks(value: unknown, label: string): GeneratedChunk[] {
  if (!Array.isArray(value) || value.length > MAX_CHUNKS_PER_TYPE) {
    throw new Error(label + " must have at most one chunk");
  }
  return value.map((c: unknown) => {
    if (!record(c)) throw new Error(label + " chunk is not an object");
    const text = required(c.targetText ?? c.text, label + ".text");
    const meaning = required(c.meaning, label + ".meaning");
    const proposed = optional(c.proposedCanonicalMeaning, label + ".proposedCanonicalMeaning");
    const semanticGroupId = optional(c.semanticGroupId, label + ".semanticGroupId") ?? "";
    // A new group can be proposed, but never silently made up by the client.
    if (!semanticGroupId && !proposed) {
      throw new Error(label + " requires semanticGroupId or proposedCanonicalMeaning");
    }
    return {
      text, meaning,
      ipa: optional(c.ipa, label + ".ipa") ?? "",
      romanization: optional(c.romanization, label + ".romanization") ?? "",
      semanticGroupId,
      ...(proposed ? { proposedCanonicalMeaning: proposed } : {}),
      ...(optional(c.english, label + ".english") ? { english: optional(c.english, label + ".english") } : {}),
    };
  });
}

export function validateGeneratedResponse(raw: unknown, sourceLanguage?: string, targetLanguage?: string): GeneratedResponse {
  if (!record(raw)) throw new Error("Response must be a JSON object");
  const version = raw.contractVersion == null
    ? "1" : String(raw.contractVersion);
  if (version !== "1" && version !== "2") throw new Error("Unsupported AI contract version");
  const source = sourceLanguage ? getLanguageProfile(sourceLanguage).locale :
    typeof raw.sourceLanguage === "string" ? getLanguageProfile(raw.sourceLanguage).locale : undefined;
  const target = targetLanguage ? getLanguageProfile(targetLanguage).locale :
    typeof raw.targetLanguage === "string" ? getLanguageProfile(raw.targetLanguage).locale : undefined;
  if (version === "2" && (!source || !target)) throw new Error("V2 requires source and target languages");
  if (Array.isArray(raw.semanticUnits) && raw.semanticUnits.length > 0 && raw.semanticUnits.length <= MAX_SEMANTIC_UNITS) {
    const seen = new Set<number>();
    const semanticUnits = raw.semanticUnits.map((unit, index) => {
      if (!record(unit)) throw new Error("Semantic unit must be an object");
      const order = unit.order;
      if (typeof order !== "number" || !Number.isSafeInteger(order) || order < 1 || seen.has(order)) {
        throw new Error("Semantic unit order must be unique positive integer");
      }
      seen.add(order);
      const sourceText = required(unit.sourceText ?? unit.nativeText, "semanticUnits[" + index + "].sourceText");
      return {
        order,
        sourceText,
        nativeText: sourceText,
        ...(optional(unit.englishText, "englishText") ? { englishText: optional(unit.englishText, "englishText") } : {}),
        commonChunks: chunks(unit.commonChunks, "commonChunks"),
        personalizedChunks: chunks(unit.personalizedChunks, "personalizedChunks"),
      };
    });
    return {
      contractVersion: version,
      ...(source ? { sourceLanguage: source } : {}),
      ...(target ? { targetLanguage: target } : {}),
      ...(optional(raw.englishNarrative, "englishNarrative") ? { englishNarrative: optional(raw.englishNarrative, "englishNarrative") } : {}),
      ...(optional(raw.narrative, "narrative") ? { narrative: optional(raw.narrative, "narrative") } : {}),
      semanticUnits,
    };
  }
  throw new Error("semanticUnits requires between 1 and 40 entries");
}
