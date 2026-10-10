import { handleRequest, validateResponse } from "./index.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const validBody = {
  contractVersion: "2", requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  diaryContent: "Hôm nay tôi đọc sách.",
  nativeLanguage: "Vietnamese", targetLanguage: "Japanese",
  existingSemanticGroups: [],
};
function request(body: unknown, authenticated = false): Request {
  return new Request("https://example.invalid/functions/v1/generate-chunks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: "Bearer mocked-user-access-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function code(response: Response): Promise<string> {
  const payload = await response.json();
  return payload?.error?.code ?? payload?.success;
}

Deno.test("M3: invalid input never reaches authentication or provider", async () => {
  const missing = await handleRequest(request({ ...validBody, diaryContent: "" }));
  assert(missing.status === 400 && await code(missing) === "INVALID_REQUEST", "empty diary must fail");
  const wrongVersion = await handleRequest(request({ ...validBody, contractVersion: "1" }));
  assert(wrongVersion.status === 400, "wrong contract version must fail");
  const huge = await handleRequest(request({ ...validBody, diaryContent: "a".repeat(12001) }));
  assert(huge.status === 400, "oversized diary must fail");
});

Deno.test("M3: missing JWT is rejected without invoking paid provider", async () => {
  const response = await handleRequest(request(validBody));
  assert(response.status === 401 && await code(response) === "AUTH_REQUIRED", "must reject missing JWT");
});

Deno.test("M3: authenticated user still fails closed when rollout disabled, no diary in response", async () => {
  const originalFetch = globalThis.fetch;
  const previous = {
    url: Deno.env.get("SUPABASE_URL"),
    key: Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    enabled: Deno.env.get("CHUNKDIARY_AI_ENABLED"),
  };
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_mock");
  Deno.env.delete("CHUNKDIARY_AI_ENABLED");
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls++;
    assert(String(input).includes("/auth/v1/user"), "unexpected backend call");
    return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
  }) as typeof fetch;
  try {
    const response = await handleRequest(request(validBody, true));
    const body = await response.text();
    assert(response.status === 503 && JSON.parse(body).error.code === "CONFIGURATION_ERROR", "must fail closed");
    assert(calls === 1, "only Auth verification should occur");
    assert(!body.includes(validBody.diaryContent), "diary content leaked");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [
      ["SUPABASE_URL", previous.url],
      ["SUPABASE_PUBLISHABLE_KEY", previous.key],
      ["CHUNKDIARY_AI_ENABLED", previous.enabled],
    ] as const) value == null ? Deno.env.delete(key) : Deno.env.set(key, value);
  }
});

Deno.test("M3: missing quota RPC denies even when rollout flag is true", async () => {
  const originalFetch = globalThis.fetch;
  const vars = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CHUNKDIARY_AI_ENABLED", "GEMINI_API_KEY", "CHUNKDIARY_PROMPT_V2", "CHUNKDIARY_PROMPT_VERSION"] as const;
  const prev = vars.map((key) => Deno.env.get(key));
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_mock");
  Deno.env.set("CHUNKDIARY_AI_ENABLED", "true");
  Deno.env.set("GEMINI_API_KEY", "test-only-not-a-real-key");
  Deno.env.set("CHUNKDIARY_PROMPT_V2", "fake prompt for tests");
  Deno.env.set("CHUNKDIARY_PROMPT_VERSION", "v2-test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service_role_test_only_secret");
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    if (String(input).endsWith("/auth/v1/user")) return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    return new Response("missing quota claim function", { status: 404 });
  }) as typeof fetch;
  try {
    const denied = await handleRequest(request(validBody, true));
    assert(denied.status === 503 && await code(denied) === "CONFIGURATION_ERROR", "missing quota must deny");
    assert(urls.length === 2 && urls[1].includes("/rpc/chunkdiary_ai_quota_claim"), "quota not checked");
  } finally {
    globalThis.fetch = originalFetch;
    for (let i = 0; i < vars.length; i++) prev[i] == null ? Deno.env.delete(vars[i]) : Deno.env.set(vars[i], prev[i]!);
  }
});

Deno.test("M4: quota claim is service-only and pins user to verified token", async () => {
  const originalFetch = globalThis.fetch;
  const vars = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CHUNKDIARY_AI_ENABLED", "GEMINI_API_KEY", "CHUNKDIARY_PROMPT_V2", "CHUNKDIARY_PROMPT_VERSION"] as const;
  const previous = vars.map((key) => Deno.env.get(key));
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "test_publishable_only");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "server_only_test_key");
  Deno.env.set("CHUNKDIARY_AI_ENABLED", "true");
  Deno.env.set("GEMINI_API_KEY", "test-only-not-a-real-key");
  Deno.env.set("CHUNKDIARY_PROMPT_V2", "fake prompt for tests");
  Deno.env.set("CHUNKDIARY_PROMPT_VERSION", "v2-test");
  let checked = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    if (url.includes("/rpc/chunkdiary_ai_quota_claim")) {
      checked = true;
      const body = JSON.parse(String(init?.body));
      if (body.p_daily_limit !== undefined || body.p_user_id !== "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" ||
          body.p_request_id !== validBody.requestId ||
          init?.headers === undefined ||
          (init.headers as Record<string,string>).Authorization !== "Bearer server_only_test_key") {
        throw new Error("Quota claim not constrained to server-verified user");
      }
      return Response.json({ allowed: false, new_claim: false });
    }
    throw new Error("Unexpected provider call");
  }) as typeof fetch;
  try {
    const response = await handleRequest(request({ ...validBody, userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, true));
    assert(response.status === 429 && await code(response) === "RATE_LIMITED", "quota denied call must not invoke provider");
    assert(checked, "quota claim must be attempted");
  } finally {
    globalThis.fetch = originalFetch;
    for (let i = 0; i < vars.length; i++) previous[i] == null
      ? Deno.env.delete(vars[i]) : Deno.env.set(vars[i], previous[i]!);
  }
});

Deno.test("M4: missing private prompt denies request BEFORE consuming quota", async () => {
  const originalFetch = globalThis.fetch;
  const vars = [
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "CHUNKDIARY_AI_ENABLED", "GEMINI_API_KEY", "CHUNKDIARY_PROMPT_V2",
    "CHUNKDIARY_PROMPT_VERSION",
  ] as const;
  const saved = vars.map((k) => Deno.env.get(k));
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "test_pub");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test_service");
  Deno.env.set("CHUNKDIARY_AI_ENABLED", "true");
  Deno.env.set("GEMINI_API_KEY", "test_key");
  Deno.env.set("CHUNKDIARY_PROMPT_VERSION", "v2-test");
  Deno.env.delete("CHUNKDIARY_PROMPT_V2");
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls++;
    if (!String(input).endsWith("/auth/v1/user")) throw new Error("quota was consumed or provider reached");
    return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
  }) as typeof fetch;
  try {
    const response = await handleRequest(request(validBody, true));
    assert(response.status === 503 && await code(response) === "CONFIGURATION_ERROR",
      "incomplete provider config must fail closed");
    assert(calls === 1, "only Auth should be checked");
  } finally {
    globalThis.fetch = originalFetch;
    for (let i = 0; i < vars.length; i++) saved[i] == null
      ? Deno.env.delete(vars[i]) : Deno.env.set(vars[i], saved[i]!);
  }
});

Deno.test("M4: group IDs must match caller's known groups, not fabricated by model", () => {
  const candidate = {
    contractVersion: "2",
    narrative: "私は本を読みました。",
    semanticUnits: [{
      order: 1, sourceText: "Tôi đã đọc sách.",
      commonChunks: [{
        targetText: "本を読みました", meaning: "đã đọc sách",
        semanticGroupId: "invented-model-id", proposedCanonicalMeaning: "",
      }],
      personalizedChunks: [],
    }],
  };
  let rejected = false;
  try { validateResponse(candidate, "vi-VN", "ja-JP", ["actual-id"]); }
  catch { rejected = true; }
  assert(rejected, "fabricated model group ID must be rejected");
  candidate.semanticUnits[0].commonChunks[0].semanticGroupId = "actual-id";
  assert(validateResponse(candidate, "vi-VN", "ja-JP", ["actual-id"]).contractVersion === "2",
    "valid known group ID should succeed");
});

Deno.test("M4: authenticated API request UUID format, German/Italian locales", async () => {
  const malformed = await handleRequest(request({ ...validBody, requestId: "----" }));
  assert(malformed.status === 400, "malformed requestId rejected before Auth");
  const italian = await handleRequest(request({ ...validBody, targetLanguage: "Italian" }));
  assert(italian.status === 401, "Italian now accepted and reaches Auth");
  const german = await handleRequest(request({ ...validBody, targetLanguage: "German" }));
  assert(german.status === 401, "German now accepted and reaches Auth");
});
