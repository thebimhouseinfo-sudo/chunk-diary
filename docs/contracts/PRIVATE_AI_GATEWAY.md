# M3/M4 — Private AI Gateway and External Configuration Gate

Status (2026-10-10): **dedicated development project confirmed** (`nwowifnlfgcmmoiglgmu`). Three development SQL migrations applied; `generate-chunks` Edge Function deployed with JWT verification. **AI remains disabled**, no private v2 prompt has been supplied or tested, no Gemini calls made, and no main/production release.

## Source and prompt boundary

- `supabase/functions/generate-chunks/index.ts` implements a contractVersion=2 request gateway. It checks shape/length, validates the bearer token via Supabase Auth, and validates model output before returning a bounded object. It does not log diaries, raw model responses or provider error messages.
- **Private prompt content is NOT stored in Git**. The new versioned system instruction is loaded ONLY from server-side `CHUNKDIARY_PROMPT_V2`; it is never accepted from the client. `CHUNKDIARY_PROMPT_VERSION` identifies the private prompt without disclosing it.
- The old Gemini and OpenAI-compatible prompt implementations and client-provided API-key handling in root `server.ts` have been retired: `/api/generate-chunks` fails closed until an authenticated Edge gateway is configured. The old public Git history still contains disclosed prompts and cannot be made private retroactively by editing current files.
- `src/utils/aiService.ts` now sends `contractVersion: "2"`, requestId and validated user content/profile only. No self-asserted `userId`, device fingerprint or provider key is sent. It accepts legacy beta v1 responses through the M2 compatibility parser only during development.

## Durable quota and security requirements

- The Edge gateway is **disabled by default** and requires `CHUNKDIARY_AI_ENABLED=true` set by an authorized operator. This flag is insufficient to enable paid calls: every call MUST also successfully invoke the authenticated database RPC `chunkdiary_ai_quota_claim` to reserve a durable per-user daily quota slot and prevent double billing on repeated request IDs.
- Implemented RPC contract: POST `/rest/v1/rpc/chunkdiary_ai_quota_claim` with **server-only service-role authorization** and JSON `{ "p_user_id": "<verified Auth UUID>", "p_request_id": "<uuid>" }`. Only the Edge Function, after verifying the caller via `/auth/v1/user`, supplies `p_user_id`; the browser cannot call the RPC. No client-adjustable quota limit exists. Responses are `{ "allowed": true, "new_claim": true }` only for fresh eligible claims; duplicates/limits deny. The SQL configuration defaults to `enabled=false`, 2 requests/user/day, 50 global/day and 500 global/month. The latest Supabase security audit has **no WARNs**; two INFO notices flag the intentionally policy-free private quota tables.
- Development migrations already applied: `chunkdiary_dev_cloud_sync_owner_scoped`, `chunkdiary_dev_ai_quota_disabled`, `chunkdiary_dev_quota_edge_only`. All four user-owned public tables have RLS; progress/corpus uniqueness is `(user_id,id)`. The private quota claim is executable by `service_role` only, not `anon` or `authenticated`. **Still required before enabling:** live RLS tests with two users, quota concurrency/race tests, operator spend monitoring and explicit staging QA. GitHub migration file timestamps differ from the Supabase dashboard-generated migration history; reconcile this history before using `supabase db push`, never blindly replay migrations.
- These controls are necessary but not yet sufficient for production: rate limits against numerous new anonymous identities, global provider budget, model cost monitoring, operator kill switch, retention terms, response latency/quality evaluations and staging RLS checks remain M4 gates.

## Required external setup (USER ACTION — when ready)

1. **Complete:** Dedicated development project `Chunkdiary` confirmed at `nwowifnlfgcmmoiglgmu`; no need to ask for the reference again.
2. **Available from the project:** public URL `https://nwowifnlfgcmmoiglgmu.supabase.co` and a modern publishable key. Configure both as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a non-production app environment when connected; the service-role key stays **Edge-only** and must never be placed in Git or in `VITE_*`.
3. In Supabase **Edge Functions → Secrets**, privately configure `GEMINI_API_KEY`, `CHUNKDIARY_PROMPT_V2` (a new private instruction, not reusing exposed Git prompt), and `CHUNKDIARY_PROMPT_VERSION`. Also configure `CHUNKDIARY_AI_DAILY_LIMIT` only after quota migration/testing; keep `CHUNKDIARY_AI_ENABLED` **unset/false** until all security gates pass.
4. Ensure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or supported legacy `SUPABASE_ANON_KEY`) are available to the Edge Function for its Auth and quota requests. Never put `GEMINI_API_KEY`, private prompt, or service-role/secret keys under `VITE_` or in repository files.
5. **Completed in dev project:** schema/RLS, quota SQL and JWT-protected Edge deployment. Still **pending**: true Auth/RLS two-user tests, provider key and prompt-version functional check, cost caps, staging E2E and Human release approval. Do not target GitHub `main` or Vercel production.

Do not paste secret values into ChatGPT. Configure secrets directly in the Supabase dashboard or an explicitly connected secret-management workflow.

## Testing scope

`.github/workflows/m3-edge.yml` uses Deno to type-check the Edge module and run negative-control tests with mocked Supabase Auth/quota HTTP; it builds the retired local Express server. It never makes a paid model request or uses a real key. M2 frontend contract tests are separate. M3 is **not yet complete as a real-provider integration** until user-side protected configuration, migration and review.

## Processing notice

StoryChat now asks before **each** transient AI generation request. Accepting this action authorizes third-party model processing of the selected diary text, **not** persistent cloud backup or corpus sharing. Provider subprocessors/retention and finalized consent language still require legal/product review before production release.

## 2026-10-10 staging checkpoint after operator secret setup

- Human confirmed that `CHUNKDIARY_PROMPT_V2` and `CHUNKDIARY_PROMPT_VERSION` were saved using Supabase's Edge Functions Secrets UI, following prior `GEMINI_API_KEY` setup. **The connector cannot list or reveal Edge secret values, so this is operator confirmation, not a successful provider handshake.** Never copy secret contents to repository, CI logs or chat.
- Exact source in `codex/supabase-app` deployed to the dedicated Chunkdiary development project as `generate-chunks` **v4**, `verify_jwt=true`. Source matches deployed function at the deployment checkpoint.
- The Edge validator now rejects fabricated semantic-group IDs, handles German/Italian locale aliases, requires an actual UUID request ID, and checks for private provider configuration **before reserving quota**. Requests still require verified JWT identity and the server-only quota RPC.
- Staging SQL rollback test `tests/sql/owner_rls.sql` passed for all four public tables, including account A/B isolation and identical user-owned record IDs. All synthetic auth users and rows were rolled back. Quota stays `enabled=false`.
- GitHub Actions [M3 staging security checks](https://github.com/thebimhouseinfo-sudo/chunk-diary/actions/runs/38050205458) passed Edge typecheck, eight hermetic negative-control tests, server compilation, and a **live staging invalid-JWT rejection** without provider traffic. Supabase Security Advisor has zero WARN/ERROR notices, with only expected INFO for policy-free private quota tables.
- **NOT YET PASS:** live Gemini response quality, actual billing/quota enforcement with a real Auth JWT, confirmation of secret presence in Edge runtime, production-quality Thai/other unsupported locale coverage, end-to-end authenticated frontend generation, or final release. No production merge/deploy and no paid Gemini call.
- For **one controlled synthetic provider smoke test only**, prepare a valid staging Auth identity, set quota's private per-user/global cap to exactly one invocation, have the operator temporarily enable `CHUNKDIARY_AI_ENABLED=true` as a Supabase Edge secret, run a bounded synthetic-data test, then disable both gate and quota. Do not assume that saving a prompt secret enabled paid calls.
