import { GoogleGenAI, Type } from "npm:@google/genai@2.4.0";

/**
 * M3/M4 staging-only Edge gateway. The private instruction is read from
 * Deno.env, NOT defined in any tracked file, bundle, network response or log.
 * The function stays disabled until real Auth, quota and provider QA pass.
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const maxDiaryCharacters = 12000;
const maxGroups = 80;
const maxUnits = 40;
const allowedLanguages = new Set(["vi", "en", "zh", "ja", "ko", "es", "fr", "de", "it"]);

type ErrorCode = "INVALID_REQUEST" | "AUTH_REQUIRED" | "RATE_LIMITED" |
  "PAYLOAD_TOO_LARGE" | "CONFIGURATION_ERROR" | "INVALID_MODEL_OUTPUT" |
  "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT";

function respond(code: number, result: unknown): Response {
  return Response.json(result, { status: code, headers: cors });
}
function failure(status: number, code: ErrorCode, requestId?: string): Response {
  return respond(status, {
    success: false, requestId,
    error: { code, retryable: status === 408 || status === 429 || status >= 500 },
  });
}
function record(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function cleanLang(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 40) throw new Error("invalid locale");
  const name = raw.trim().toLowerCase();
  const aliases: Record<string, string> = {
    vietnamese: "vi-VN", english: "en-US", chinese: "zh-CN", mandarin: "zh-CN",
    japanese: "ja-JP", korean: "ko-KR", spanish: "es-ES", french: "fr-FR",
    german: "de-DE", italian: "it-IT",
  };
  const canonical = Intl.getCanonicalLocales(aliases[name] ?? raw.trim().replace(/_/g, "-"))[0];
  if (!canonical || !allowedLanguages.has(canonical.split("-")[0])) throw new Error("unsupported locale");
  return canonical;
}
function validateRequest(body: unknown) {
  if (!record(body) || body.contractVersion !== "2" ||
      typeof body.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) {
    throw new Error("invalid contract");
  }
  if (typeof body.diaryContent !== "string" || !body.diaryContent.trim() ||
      body.diaryContent.length > maxDiaryCharacters) throw new Error("invalid diary");
  const groups = body.existingSemanticGroups == null ? [] : body.existingSemanticGroups;
  if (!Array.isArray(groups) || groups.length > maxGroups ||
      groups.some((g) => !record(g) || typeof g.id !== "string" ||
        typeof g.canonicalMeaning !== "string" ||
        g.canonicalMeaning.length > 500 || !g.canonicalMeaning.trim() ||
        g.id.length > 255 || !g.id.trim())) throw new Error("invalid groups");
  const allowedText = (value: unknown, max: number): string =>
    typeof value === "string" && value.length <= max ? value : "";
  return {
    requestId: body.requestId,
    diaryContent: body.diaryContent,
    sourceLanguage: cleanLang(body.nativeLanguage),
    targetLanguage: cleanLang(body.targetLanguage),
    level: allowedText(body.cefrLevel, 50),
    specialty: allowedText(body.specialty, 120),
    subSpecialty: allowedText(body.subSpecialty, 120),
    profileContext: allowedText(body.profileContext, 300),
    existingSemanticGroups: groups.map((g) => ({
      id: g.id, canonicalMeaning: g.canonicalMeaning,
    })),
  };
}
function validateResponse(
  raw: unknown, sourceLanguage: string, targetLanguage: string, knownGroupIds: readonly string[],
): Record<string, unknown> {
  if (!record(raw) || raw.contractVersion !== "2" ||
      !Array.isArray(raw.semanticUnits) || !raw.semanticUnits.length ||
      raw.semanticUnits.length > maxUnits) throw new Error("invalid response envelope");
  const usedOrders = new Set<number>();
  const validGroups = new Set(knownGroupIds);
  const units = raw.semanticUnits.map((unit) => {
    if (!record(unit) || !Number.isInteger(unit.order) || Number(unit.order) < 1 ||
        usedOrders.has(Number(unit.order)) || typeof unit.sourceText !== "string" ||
        !unit.sourceText.trim() || unit.sourceText.length > 12000) throw new Error("invalid unit");
    usedOrders.add(Number(unit.order));
    const parseChunks = (items: unknown) => {
      if (!Array.isArray(items) || items.length > 1) throw new Error("invalid chunk count");
      return items.map((chunk) => {
        if (!record(chunk) || typeof chunk.targetText !== "string" || !chunk.targetText.trim() ||
            typeof chunk.meaning !== "string" || !chunk.meaning.trim() ||
            chunk.targetText.length > 500 || chunk.meaning.length > 1000 ||
            (typeof chunk.semanticGroupId !== "string" || !chunk.semanticGroupId.trim()) &&
            (typeof chunk.proposedCanonicalMeaning !== "string" || !chunk.proposedCanonicalMeaning.trim())) {
          throw new Error("invalid chunk");
        }
        // Never accept a fabricated semantic-group ID: it must have been sent
        // by this caller. New semantics must supply a proposed meaning instead.
        const id = typeof chunk.semanticGroupId === "string" ? chunk.semanticGroupId.trim() : "";
        if (id && !validGroups.has(id)) throw new Error("unknown semantic group");
        return {
          targetText: chunk.targetText.trim(), meaning: chunk.meaning.trim(),
          ipa: typeof chunk.ipa === "string" ? chunk.ipa.slice(0, 200) : "",
          romanization: typeof chunk.romanization === "string" ? chunk.romanization.slice(0, 200) : "",
          semanticGroupId: typeof chunk.semanticGroupId === "string" ? chunk.semanticGroupId : "",
          ...(typeof chunk.proposedCanonicalMeaning === "string" ?
            { proposedCanonicalMeaning: chunk.proposedCanonicalMeaning.trim() } : {}),
        };
      });
    };
    return {
      order: unit.order, sourceText: unit.sourceText.trim(),
      commonChunks: parseChunks(unit.commonChunks),
      personalizedChunks: parseChunks(unit.personalizedChunks),
    };
  });
  return {
    contractVersion: "2", sourceLanguage, targetLanguage,
    narrative: typeof raw.narrative === "string" ? raw.narrative.slice(0, 12000) : "",
    semanticUnits: units,
  };
}

const chunkShape = {
  type: Type.OBJECT,
  properties: {
    targetText: { type: Type.STRING },
    meaning: { type: Type.STRING },
    ipa: { type: Type.STRING },
    romanization: { type: Type.STRING },
    semanticGroupId: { type: Type.STRING },
    proposedCanonicalMeaning: { type: Type.STRING },
  },
  required: ["targetText", "meaning", "semanticGroupId", "proposedCanonicalMeaning"],
};
const outputShape = {
  type: Type.OBJECT,
  properties: {
    contractVersion: { type: Type.STRING },
    narrative: { type: Type.STRING },
    semanticUnits: {
      type: Type.ARRAY, items: {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.INTEGER },
          sourceText: { type: Type.STRING },
          commonChunks: { type: Type.ARRAY, items: chunkShape },
          personalizedChunks: { type: Type.ARRAY, items: chunkShape },
        },
        required: ["order", "sourceText", "commonChunks", "personalizedChunks"],
      },
    },
  },
  required: ["contractVersion", "semanticUnits"],
};

async function verifiedUser(request: Request): Promise<string | null> {
  const auth = request.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth?.startsWith("Bearer ") || !url || !key) return null;
  // Never trust request.body.userId or a client-provided unverified JWT payload.
  const response = await fetch(url.replace(/\/$/, "") + "/auth/v1/user", {
    method: "GET",
    headers: { Authorization: auth, apikey: key },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return null;
  const user: unknown = await response.json();
  return record(user) && typeof user.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id)
    ? user.id : null;
}

/**
 * M4 safety barrier. Every paid request MUST claim a durable, atomic,
 * authenticated quota slot. The Postgres RPC will only exist when an
 * authorized ChunkDiary staging migration is applied. Missing => fail closed.
 */
async function claimQuota(userId: string, requestId: string): Promise<"allowed" | "limited" | "unavailable"> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // Only server-to-server calls can reserve provider budget.
  // The ID comes from a verified Supabase Auth /user response, never request JSON.
  if (!url || !serviceKey) return "unavailable";
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/chunkdiary_ai_quota_claim", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + serviceKey,
        apikey: serviceKey, "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: userId, p_request_id: requestId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "unavailable";
    const body: unknown = await response.json();
    if (record(body) && body.allowed === true && body.new_claim === true) return "allowed";
    if (record(body) && body.allowed === false) return "limited";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return respond(200, {});
  if (req.method !== "POST") return failure(405, "INVALID_REQUEST");
  if ((Number(req.headers.get("content-length") || 0)) > 45000) {
    return failure(413, "PAYLOAD_TOO_LARGE");
  }
  let input;
  try {
    input = validateRequest(await req.json());
  } catch {
    return failure(400, "INVALID_REQUEST");
  }
  const requestId = input.requestId;
  let userId: string | null = null;
  try {
    userId = await verifiedUser(req);
    if (!userId) return failure(401, "AUTH_REQUIRED", requestId);
  } catch {
    return failure(503, "PROVIDER_UNAVAILABLE", requestId);
  }

  if (Deno.env.get("CHUNKDIARY_AI_ENABLED") !== "true") {
    return failure(503, "CONFIGURATION_ERROR", requestId);
  }
  // Missing provider configuration must not consume a user's paid-call quota.
  // Configuration cannot be probed by unauthenticated callers.
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const privatePrompt = Deno.env.get("CHUNKDIARY_PROMPT_V2");
  const promptVersion = Deno.env.get("CHUNKDIARY_PROMPT_VERSION") || "";
  if (!apiKey || !privatePrompt || !promptVersion) {
    return failure(503, "CONFIGURATION_ERROR", requestId);
  }
  const quota = await claimQuota(userId, requestId);
  if (quota === "limited") return failure(429, "RATE_LIMITED", requestId);
  if (quota !== "allowed") return failure(503, "CONFIGURATION_ERROR", requestId);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash",
      contents: JSON.stringify(input),
      config: {
        systemInstruction: privatePrompt,
        responseMimeType: "application/json",
        responseSchema: outputShape,
        maxOutputTokens: 4096,
        abortSignal: AbortSignal.timeout(45000),
      },
    });
    const parsed: unknown = response.text ? JSON.parse(response.text) : null;
    const result = validateResponse(
      parsed, input.sourceLanguage, input.targetLanguage,
      input.existingSemanticGroups.map((group) => group.id),
    );
    return respond(200, {
      success: true, requestId, contractVersion: "2", promptVersion, result,
    });
  } catch {
    // Deliberately no error.message, diary content, raw provider output or prompt.
    return failure(502, "INVALID_MODEL_OUTPUT", requestId);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
