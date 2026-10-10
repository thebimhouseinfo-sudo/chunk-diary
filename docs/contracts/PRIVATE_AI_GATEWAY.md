# M3/M4 — Private AI Gateway and External Configuration Gate

Status: **source-only backend gateway implemented; external integration BLOCKED until a dedicated, user-approved ChunkDiary Supabase project and secrets exist. NO deploy or live paid model calls have been executed.**

## Source and prompt boundary

- `supabase/functions/generate-chunks/index.ts` implements a contractVersion=2 request gateway. It checks shape/length, validates the bearer token via Supabase Auth, and validates model output before returning a bounded object. It does not log diaries, raw model responses or provider error messages.
- **Private prompt content is NOT stored in Git**. The new versioned system instruction is loaded ONLY from server-side `CHUNKDIARY_PROMPT_V2`; it is never accepted from the client. `CHUNKDIARY_PROMPT_VERSION` identifies the private prompt without disclosing it.
- The old Gemini and OpenAI-compatible prompt implementations and client-provided API-key handling in root `server.ts` have been retired: `/api/generate-chunks` fails closed until an authenticated Edge gateway is configured. The old public Git history still contains disclosed prompts and cannot be made private retroactively by editing current files.
- `src/utils/aiService.ts` now sends `contractVersion: "2"`, requestId and validated user content/profile only. No self-asserted `userId`, device fingerprint or provider key is sent. It accepts legacy beta v1 responses through the M2 compatibility parser only during development.

## Durable quota and security requirements

- The Edge gateway is **disabled by default** and requires `CHUNKDIARY_AI_ENABLED=true` set by an authorized operator. This flag is insufficient to enable paid calls: every call MUST also successfully invoke the authenticated database RPC `chunkdiary_ai_quota_claim` to reserve a durable per-user daily quota slot and prevent double billing on repeated request IDs.
- Expected RPC contract: POST `/rest/v1/rpc/chunkdiary_ai_quota_claim` with JWT Authorization and JSON `{ "p_request_id": "<uuid>", "p_daily_limit": <1..100> }`. It returns JSON `{ "allowed": true, "new_claim": true }` **only** if a unique new slot was atomically claimed for `auth.uid()`; duplicates/over-limit return `{ "allowed": false, "new_claim": false }`. All failures/missing RPC or invalid Auth deny provider invocation.
- Implement the RPC in a **separate reviewed and tested database migration**, with a user-scoped unique request ID, daily limit, correct `auth.uid()` ownership checks, restrictive API grants, and race-condition tests. Never configure a manual `CHUNKDIARY_QUOTA_VERIFIED` bypass. **This RPC migration has NOT been created/applied to a real project**.
- These controls are necessary but not yet sufficient for production: rate limits against numerous new anonymous identities, global provider budget, model cost monitoring, operator kill switch, retention terms, response latency/quality evaluations and staging RLS checks remain M4 gates.

## Required external setup (USER ACTION — when ready)

1. **Confirm or create a dedicated ChunkDiary Supabase project**. A connected Supabase account currently lists only a generic project; do **not** reuse an unrelated GSA/other project's database. Provide only the project's **name/project reference** in chat, never passwords or secret values.
2. In that project, configure the public app-side values `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the app's **development/staging environment** (not production yet). A publishable key is safe to expose in browser; service-role/secret keys never are.
3. In Supabase **Edge Functions → Secrets**, privately configure `GEMINI_API_KEY`, `CHUNKDIARY_PROMPT_V2` (a new private instruction, not reusing exposed Git prompt), and `CHUNKDIARY_PROMPT_VERSION`. Also configure `CHUNKDIARY_AI_DAILY_LIMIT` only after quota migration/testing; keep `CHUNKDIARY_AI_ENABLED` **unset/false** until all security gates pass.
4. Ensure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or supported legacy `SUPABASE_ANON_KEY`) are available to the Edge Function for its Auth and quota requests. Never put `GEMINI_API_KEY`, private prompt, or service-role/secret keys under `VITE_` or in repository files.
5. Approve the **dedicated staging database migration and Edge staging deployment** only after reviewing exact SQL and security/consent tests. Do not target production or `main` as part of development.

Do not paste secret values into ChatGPT. Configure secrets directly in the Supabase dashboard or an explicitly connected secret-management workflow.

## Testing scope

`.github/workflows/m3-edge.yml` uses Deno to type-check the Edge module and run negative-control tests with mocked Supabase Auth/quota HTTP; it builds the retired local Express server. It never makes a paid model request or uses a real key. M2 frontend contract tests are separate. M3 is **not yet complete as a real-provider integration** until user-side protected configuration, migration and review.

## Processing notice

StoryChat now asks before **each** transient AI generation request. Accepting this action authorizes third-party model processing of the selected diary text, **not** persistent cloud backup or corpus sharing. Provider subprocessors/retention and finalized consent language still require legal/product review before production release.
