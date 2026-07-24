/**
 * Clean AI Service helper for processing diary entries via Google App Script endpoint.
 */

import { SemanticGroup } from "../types";

export function getBrowserFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || "",
    (navigator as any).deviceMemory || ""
  ];
  const rawString = parts.join("|");

  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  let localId = localStorage.getItem("browser_fingerprint_id");
  if (!localId) {
    localId = "FP-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
    localStorage.setItem("browser_fingerprint_id", localId);
  }

  return `FP-${Math.abs(hash)}-${localId}`;
}

const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbw1BN924Xro2vfsU9eC1WkU_jBKGAwMTvNtn6h-2QtkwyJrUox20jfNAuYFwZj0CfKm/exec";

export interface AIServiceResponse {
  englishNarrative: string;
  semanticUnits: Array<{
    order: number;
    nativeText: string;
    englishText: string;
    commonChunks: Array<{
      english: string;
      text: string;
      meaning: string;
      ipa: string;
      romanization: string;
      semanticGroupId: string;
      proposedCanonicalMeaning?: string;
    }>;
    personalizedChunks: Array<{
      english: string;
      text: string;
      meaning: string;
      ipa: string;
      romanization: string;
      semanticGroupId: string;
      proposedCanonicalMeaning?: string;
    }>;
  }>;
}

export interface GenerateChunksInput {
  diaryContent: string;
  nativeLanguage: string;
  targetLanguage: string;
  cefrLevel?: string;
  specialty?: string;
  subSpecialty?: string;
  profileContext: string;
  existingSemanticGroups: SemanticGroup[];
}

/**
 * Builds a structured profile context string emphasizing user specialty and purpose for AI personalization.
 */
export function buildProfileContext(settings?: {
  specialty?: string;
  subSpecialty?: string;
  learningPurpose?: string;
  nickname?: string;
}): string {
  if (!settings) return "";
  const parts: string[] = [];
  if (settings.specialty) parts.push(`Specialty/Profession: ${settings.specialty}`);
  if (settings.subSpecialty) parts.push(`Sub-Specialty: ${settings.subSpecialty}`);
  if (settings.learningPurpose) parts.push(`Purpose: ${settings.learningPurpose}`);
  return parts.join(" | ");
}

/**
 * Sends diary and user profile details to the Apps Script backend and returns processed chunks.
 */
export async function callGenerateChunks(
  input: GenerateChunksInput,
  onStatusUpdate?: (status: "Pending" | "Processing" | "Completed" | "Failed", message: string) => void
): Promise<AIServiceResponse> {
  if (onStatusUpdate) {
    onStatusUpdate("Processing", "Đang phân tích và tạo chunks...");
  }

  const response = await fetch(ENDPOINT_URL, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "generateChunks",
      fingerprint: getBrowserFingerprint(),
      ...input
    })
  });

  if (!response.ok) {
    if (onStatusUpdate) onStatusUpdate("Failed", "Kết nối máy chủ thất bại.");
    throw new Error(`Lỗi kết nối máy chủ: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    if (onStatusUpdate) onStatusUpdate("Failed", data.error || "Lỗi xử lý dữ liệu.");
    throw new Error(data.error || "Gửi yêu cầu không thành công.");
  }

  if (onStatusUpdate) {
    onStatusUpdate("Completed", "Đã nhận kết quả phân tích thành công!");
  }

  return cleanAndParseJSON(data.result);
}

function cleanAndParseJSON(rawText: string): AIServiceResponse {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}
