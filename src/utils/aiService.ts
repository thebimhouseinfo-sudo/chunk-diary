/**
 * Clean AI Service helper for processing diary entries via the configured backend endpoint.
 */

import { SemanticGroup } from "../types";
import { ensureGuestSession } from "../services/supabase/client";
import { getSettings } from "../db/userDb";
import { validateGeneratedResponse, type GeneratedResponse } from "../domain/generation";
import { getLanguageProfile } from "../domain/language";

export const MAX_DIARY_CONTENT_LENGTH = 12000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

export type AIErrorCode =
  | "INVALID_REQUEST"
  | "AUTH_REQUIRED"
  | "PROFILE_REQUIRED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "INVALID_MODEL_OUTPUT"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly retryable = false,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}


const configuredEndpoint = import.meta.env.VITE_GENERATE_CHUNKS_ENDPOINT as string | undefined;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ENDPOINT_URL = configuredEndpoint || (supabaseUrl ? `${supabaseUrl}/functions/v1/generate-chunks` : "/api/generate-chunks");
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type AIServiceResponse = GeneratedResponse & { requestId?: string };

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

export interface GenerateChunksOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
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
 * Sends diary and user profile details to the backend and returns processed chunks.
 */
export async function callGenerateChunks(
  input: GenerateChunksInput,
  onStatusUpdate?: (status: "Pending" | "Processing" | "Completed" | "Failed", message: string) => void,
  options: GenerateChunksOptions = {}
): Promise<AIServiceResponse> {
  const requestId = crypto.randomUUID();

  try {
    validateGenerateChunksInput(input, requestId);
    onStatusUpdate?.("Processing", "Đang phân tích và tạo chunks...");

    const settings = await getSettings();
    if (supabaseUrl && !settings?.onboarded) {
      throw new AIServiceError("User profile is required to generate chunks.", "PROFILE_REQUIRED");
    }

    const session = await ensureGuestSession();
    if (supabaseUrl && !session) {
      throw new AIServiceError("User session is required to generate chunks.", "AUTH_REQUIRED");
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    const abortRequest = () => controller.abort();
    options.signal?.addEventListener("abort", abortRequest, { once: true });

    try {
      const response = await fetch(ENDPOINT_URL, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(SUPABASE_PUBLISHABLE_KEY ? { apikey: SUPABASE_PUBLISHABLE_KEY } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          action: "generateChunks",
          contractVersion: "2",
          requestId,
          // No client-chosen userId, device fingerprint or provider instructions.
          // The Edge gateway derives authorization from the verified JWT.
          ...input
        })
      });

      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        const code: AIErrorCode = response.status === 401 || response.status === 403
          ? "AUTH_REQUIRED"
          : response.status === 413
            ? "PAYLOAD_TOO_LARGE"
            : response.status === 429
              ? "RATE_LIMITED"
              : "PROVIDER_UNAVAILABLE";
        throw new AIServiceError(
          `Lỗi kết nối máy chủ: ${response.statusText}`,
          code,
          retryable,
          requestId
        );
      }

      const data = await response.json().catch(() => {
        throw new AIServiceError("Phản hồi máy chủ không hợp lệ.", "INVALID_MODEL_OUTPUT", true, requestId);
      }) as unknown;
      const result = extractResult(data, requestId);
      const validated = validateAIServiceResponse(result, requestId, input.nativeLanguage, input.targetLanguage);

      onStatusUpdate?.("Completed", "Đã nhận kết quả phân tích thành công!");
      return { ...validated, requestId };
    } catch (error) {
      if ((error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")) {
        throw new AIServiceError("Yêu cầu tạo chunks đã hết thời gian hoặc bị hủy.", "PROVIDER_TIMEOUT", true, requestId);
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", abortRequest);
    }
  } catch (error) {
    const serviceError = error instanceof AIServiceError
      ? error
      : new AIServiceError("Không thể tạo chunks. Vui lòng thử lại.", "INTERNAL_ERROR", true, requestId);
    onStatusUpdate?.("Failed", serviceError.message);
    throw serviceError;
  }
}

function validateGenerateChunksInput(input: GenerateChunksInput, requestId: string): void {
  if (!input.diaryContent.trim() || !input.nativeLanguage.trim() || !input.targetLanguage.trim()) {
    throw new AIServiceError("Thiếu nội dung hoặc thông tin ngôn ngữ.", "INVALID_REQUEST", false, requestId);
  }
  if (input.diaryContent.length > MAX_DIARY_CONTENT_LENGTH) {
    throw new AIServiceError(
      `Nội dung nhật ký vượt quá ${MAX_DIARY_CONTENT_LENGTH} ký tự.`,
      "PAYLOAD_TOO_LARGE",
      false,
      requestId
    );
  }
}

function extractResult(data: unknown, requestId: string): unknown {
  if (!isRecord(data)) {
    throw new AIServiceError("Phản hồi máy chủ không hợp lệ.", "INVALID_MODEL_OUTPUT", true, requestId);
  }
  if (data.success === false) {
    const message = typeof data.error === "string" ? data.error : "Gửi yêu cầu không thành công.";
    throw new AIServiceError(message, "PROVIDER_UNAVAILABLE", true, requestId);
  }
  return data.result ?? data;
}

function validateAIServiceResponse(
  raw: unknown, requestId: string, sourceLanguage: string, targetLanguage: string
): AIServiceResponse {
  const parsed = typeof raw === "string" ? cleanAndParseJSON(raw, requestId) : raw;
  try {
    return validateGeneratedResponse(
      parsed,
      getLanguageProfile(sourceLanguage).locale,
      getLanguageProfile(targetLanguage).locale
    );
  } catch {
    // Do not leak model payloads, provider internals or diary content.
    throw new AIServiceError("AI trả về nội dung không đúng hợp đồng đa ngôn ngữ.", "INVALID_MODEL_OUTPUT", true, requestId);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function cleanAndParseJSON(rawText: string, requestId: string): unknown {
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
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AIServiceError("AI trả về JSON không hợp lệ.", "INVALID_MODEL_OUTPUT", true, requestId);
  }
}
