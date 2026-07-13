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

const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbzv_dfCx3jSfNEcp8qxrlFR52j1b3yFQrJbAFK7u_CaavzpZuRCShKW_K-puT8jc5o/exec";

export interface AIServiceResponse {
  englishNarrative: string;
  semanticUnits: Array<{
    order: number;
    nativeText: string;
    englishText: string;
    commonChunks: Array<{
      english: string;
      text: string;
      ipa: string;
      romanization: string;
      semanticGroupId: string;
      proposedCanonicalMeaning?: string;
    }>;
    personalizedChunks: Array<{
      english: string;
      text: string;
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
  cefrLevel: string;
  profileContext: string;
  existingSemanticGroups: SemanticGroup[];
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
