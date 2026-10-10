/**
 * A SINGLE controlled, possibly billed Gemini invocation in the isolated
 * Chunkdiary development project. Not part of ordinary CI or release.
 * Runs ONLY when the operator has intentionally enabled the Edge flag AND
 * the reviewer has configured a global maximum of one SQL quota claim.
 * All diary text and user identities in this script are synthetic.
 *
 * Client contains ONLY Supabase's public publishable key, never service-role,
 * Gemini API key, or the private versioned system instruction.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { validateGeneratedResponse } from "../../src/domain/generation.ts";

const ref = "nwowifnlfgcmmoiglgmu";
const origin = process.env.CHUNKDIARY_STAGING_URL;
const key = process.env.CHUNKDIARY_STAGING_PUBLISHABLE_KEY;
const marker = "chunkdiary-m4-provider-single-ci-20261010-v1";

test("M4: exactly one authenticated synthetic provider request, then duplicate quota rejection",
{ timeout: 90000 }, async () => {
  assert.equal(process.env.CHUNKDIARY_ENABLE_LIVE_PROVIDER_SMOKE, "I_APPROVE_ONE_GEMINI_CALL",
    "Live paid-call test requires an explicit operator gate");
  assert.equal(origin, "https://" + ref + ".supabase.co", "not Chunkdiary staging project");
  assert.match(key ?? "", /^sb_publishable_/, "modern public key required");
  const client = createClient(origin!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let createdUser = false;
  try {
    const { data, error } = await client.auth.signInAnonymously({
      options: { data: { chunkdiary_ci_probe: marker } },
    });
    assert.ifError(error);
    assert.ok(data.user?.is_anonymous === true && data.session?.access_token);
    createdUser = true;

    const requestId = randomUUID();
    const body = {
      contractVersion: "2", requestId,
      diaryContent: "Hôm nay tôi đọc sách. Tôi rất vui.",
      nativeLanguage: "Vietnamese",
      targetLanguage: "Japanese",
      cefrLevel: "A1",
      existingSemanticGroups: [],
    };
    const makeRequest = () => fetch(origin! + "/functions/v1/generate-chunks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key!,
        Authorization: "Bearer " + data.session!.access_token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(50000),
    });

    // Exactly one valid NEW request ID. The private quota RPC counts claims
    // atomically, cap=1 globally, even across simultaneous users.
    const response = await makeRequest();
    assert.equal(response.status, 200, "Gemini staging smoke failed: HTTP " + response.status);
    const packet = await response.json() as Record<string, unknown>;
    assert.equal(packet.success, true);
    assert.equal(packet.promptVersion, "v2.0", "private prompt version mismatch");
    const validated = validateGeneratedResponse(packet.result, "Vietnamese", "Japanese");
    assert.equal(validated.contractVersion, "2");
    assert.equal(validated.targetLanguage, "ja-JP");
    assert.ok(validated.semanticUnits.length > 0 && validated.semanticUnits.length <= 40);
    assert.ok(validated.semanticUnits.some((unit) =>
      [...unit.commonChunks, ...unit.personalizedChunks]
        .some((chunk) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(chunk.text))
    ), "No actual Japanese-language target chunk was produced");

    // Retry EXACTLY the same paid request ID: it MUST fail quota, with no
    // second provider call. Never create a new requestId for a retry.
    const duplicate = await makeRequest();
    assert.equal(duplicate.status, 429, "duplicate request ID must be quota denied");
    const denied = await duplicate.json() as { error?: { code?: string } };
    assert.equal(denied.error?.code, "RATE_LIMITED");
    console.log("STAGING PROVIDER PASS: v2 Japanese response, one quota claim, duplicate denied");
  } finally {
    if (createdUser) {
      try { await client.auth.signOut(); } catch { /* user cleaned by exact marker SQL */ }
    }
  }
});
