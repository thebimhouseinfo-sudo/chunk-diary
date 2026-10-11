/**
 * ONE-SHOT development integration smoke; live Supabase Auth and RLS only.
 * Requires explicit public project key; no model key or service-role key.
 * Does not enable AI, quota or make paid Gemini requests.
 * Generates only synthetic users tagged for audited server-side cleanup.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.CHUNKDIARY_STAGING_URL;
const publishable = process.env.CHUNKDIARY_STAGING_PUBLISHABLE_KEY;
const marker = "chunkdiary-m4-anonymous-ci-20261010-v1";

function makeClient(): SupabaseClient {
  assert.ok(url?.endsWith("nwowifnlfgcmmoiglgmu.supabase.co"), "staging project ref mismatch");
  assert.ok(publishable?.startsWith("sb_publishable_"), "modern public key required");
  return createClient(url!, publishable!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function removeRows(client: SupabaseClient, userId: string, id: string) {
  for (const table of ["user_progress", "generated_chunk_corpus"]) {
    const { error } = await client.from(table).delete().eq("user_id", userId).eq("id", id);
    if (error) throw new Error("cleanup row failed on " + table + ": " + error.code);
  }
  for (const table of ["user_settings", "sync_snapshots"]) {
    const { error } = await client.from(table).delete().eq("user_id", userId);
    if (error) throw new Error("cleanup row failed on " + table + ": " + error.code);
  }
}

test("M6 staging: real anonymous JWTs denied account cloud data; AI quota disabled",
  { timeout: 70000 }, async () => {
    const a = makeClient();
    const b = makeClient();
    const id = "chunkdiary-ci-probe-" + randomUUID();
    const newUsers: Array<{ client: SupabaseClient; uid: string }> = [];
    try {
      for (const [client, suffix] of [[a, "a"], [b, "b"]] as const) {
        const { data, error } = await client.auth.signInAnonymously({
          options: { data: { chunkdiary_ci_probe: marker, test_owner: suffix } },
        });
        assert.ifError(error);
        assert.ok(data.user?.id && data.session?.access_token, "anonymous Auth session required");
        assert.equal(data.user.is_anonymous, true, "must be anonymous, not registered user");
        newUsers.push({ client, uid: data.user.id });
      }
      const [aa, bb] = newUsers;
      assert.notEqual(aa.uid, bb.uid, "two distinct anonymous Auth identities required");

      // M6 linked-only cloud rule supersedes the old M4 anonymous-owner
      // fixture. Anonymous JWTs remain eligible only for AI, never backup.
      for (const { client, uid } of newUsers) {
        const attempts: Array<{ table: string; entry: Record<string, unknown> }> = [
          { table: "user_settings", entry: { user_id: uid, settings: { synthetic: true } } },
          { table: "sync_snapshots", entry: { user_id: uid, payload: { synthetic: true } } },
          { table: "user_progress", entry: { user_id: uid, id, payload: { synthetic: true } } },
          { table: "generated_chunk_corpus", entry: { user_id: uid, id, payload: { synthetic: true } } },
        ];
        for (const { table, entry } of attempts) {
          const result = await client.from(table).insert(entry);
          assert.ok(result.error, table + ": anonymous INSERT must be denied");
          const rows = await client.from(table).select("user_id");
          assert.ifError(rows.error);
          assert.equal(rows.data?.length, 0, table + ": no account data visible to anonymous JWT");
        }
      }

      const cas = await a.rpc("chunkdiary_snapshot_cas_write",{
        p_payload: {format:"chunkdiary.account.cloud-backup",version:1,
          ownerUserId:aa.uid,backup:{checksum:"a".repeat(64)}},
        p_expected_checksum:null,
      });
      assert.equal(cas.data?.allowed, false, "anonymous user cannot create cloud backup");
      assert.equal(cas.data?.reason, "UNAUTHORIZED");

      // A cannot use an authenticated JWT to claim budget, even after sign-in.
      const rpc = await a.rpc("chunkdiary_ai_quota_claim", {
        p_request_id: randomUUID(), p_user_id: bb.uid,
      });
      assert.ok(rpc.error, "direct client quota claim should be denied");
      assert.ok(["42501", "PGRST202", "PGRST301"].includes(rpc.error!.code),
        "unexpected direct RPC error type: " + rpc.error!.code);

      // Real JWT works through gateway but disabled AI returns CONFIGURATION_ERROR.
      const session = (await a.auth.getSession()).data.session;
      assert.ok(session?.access_token, "signed-in access token required");
      const response = await fetch(url! + "/functions/v1/generate-chunks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishable!,
          Authorization: "Bearer " + session!.access_token,
        },
        body: JSON.stringify({
          contractVersion: "2",
          requestId: randomUUID(),
          diaryContent: "Synthetic diary text for zero-cost security verification.",
          nativeLanguage: "Vietnamese", targetLanguage: "Japanese",
          existingSemanticGroups: [],
        }),
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 503, "disabled AI must fail closed even with valid JWT");
      const body = await response.json() as { error?: { code?: string } };
      assert.equal(body.error?.code, "CONFIGURATION_ERROR");
      console.log("STAGING PASS: two anonymous JWTs, account-cloud denied, quota denied, AI disabled");
    } finally {
      const failures: string[] = [];
      for (const item of newUsers) {
        try { await removeRows(item.client, item.uid, id); }
        catch (e) { failures.push(String(e)); }
        try { await item.client.auth.signOut(); }
        catch { /* metadata-tagged synthetic Auth user will be cleaned server-side */ }
      }
      if (failures.length) {
        throw new Error("Test row cleanup failed (no access tokens logged): " + failures.join("; "));
      }
      // Server-side deletion of metadata-tagged synthetic Auth users is a separate,
      // exact-match Postgres cleanup step performed after this CI run.
    }
  });
