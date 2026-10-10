# AI Implementation Plan

## 1. Outcome

Introduce Supabase cloud generation and optional data sync without breaking the
current Apps Script beta. Prepare the same domain and service boundaries for a
future native mobile client.

## 2. Phase 0: Freeze the Current Beta Contract

Tasks:

- Record the exact Apps Script request and response shape used in production.
- Add fixture files for successful, empty, malformed, and provider-error results.
- Define the canonical contract in `docs/ai/api-contract.md`.
- Add an `AppsScriptAIAdapter` that maps legacy fields to the canonical request.
- Add a `SupabaseAIAdapter` without changing UI components.
- Select the adapter through environment configuration or a feature flag.

Exit criteria:

- Existing beta generation still works through Apps Script.
- Both adapters compile against the same TypeScript interface.
- Contract fixtures can be replayed without a live model call.

## 3. Phase 1: Harden the Client AI Boundary

Tasks:

- Move endpoint selection and response parsing out of the React view.
- Add request validation and maximum diary length.
- Add response schema validation before IndexedDB writes.
- Add request timeout and cancellation support.
- Generate and log a request id without logging diary content.
- Persist a local generation status: `pending`, `completed`, `failed`.
- Save diary, meaning units, and chunks atomically where practical.
- Preserve raw model fields needed for semantic-group assignment.

Exit criteria:

- A malformed model response cannot create partial chunks.
- A timeout shows a retryable error and does not lose the story.
- The UI is independent of the selected backend.

## 4. Phase 2: Deploy Supabase in Shadow Mode

Tasks:

- Create a Supabase project for beta testing.
- Enable anonymous auth.
- Deploy the Edge Function with `GEMINI_API_KEY` as a server secret.
- Apply migrations and verify RLS for insert, select, update, and delete paths.
- Add server-side payload limits and a basic per-user quota.
- Send a small controlled sample to Supabase while Apps Script remains the
  source of the user-visible result.
- Compare contract validity, latency, output count, and failure rate.

Exit criteria:

- Supabase does not expose provider keys.
- Shadow requests do not store raw diary text without consent.
- Supabase output passes the same validator as Apps Script output.
- Error rates and latency are measured for at least one beta cycle.

## 5. Phase 3: Make Supabase an Opt-in Generation Backend

Tasks:

- Enable Supabase generation for internal testers first.
- Keep an Apps Script fallback only for retryable Supabase failures.
- Avoid sending the same paid request twice when retrying; use `requestId`.
- Add a settings/debug view showing backend, last request status, and sync state.
- Add a kill switch to return all users to Apps Script.

Exit criteria:

- Internal testers can generate, retry, and continue offline.
- Fallback does not duplicate local diaries or chunks.
- Rollback can be done through configuration without rebuilding the client.

## 6. Phase 4: Optional Cloud Sync and Google Linking

Tasks:

- Keep IndexedDB as the local source of truth.
- Create a sync queue for settings, progress, and generated chunks.
- Mark records `pending_sync` before enqueueing.
- Retry with exponential backoff and a bounded queue.
- Add conflict handling using `updatedAt` and a documented last-write policy.
- Start anonymous Supabase sessions only when cloud features need them.
- Add explicit `Link Google account` UI.
- Verify that Google linking preserves the anonymous Supabase user id.
- Add restore flow on a new device after successful Google sign-in.
- Add privacy consent for syncing generated content.

Exit criteria:

- Local app remains usable with cloud disabled or unavailable.
- Linking Google on device A allows restore on device B.
- Duplicate sync retries are idempotent.
- User can see whether data is local, pending, synced, or failed.

## 7. Phase 5: Native Mobile Preparation

Tasks:

- Extract shared domain models and service interfaces from the web UI.
- Implement a native repository backed by SQLite or an equivalent local store.
- Implement platform-specific `SpeechRecognitionService`.
- Implement platform-specific `TextToSpeechService` and voice selection.
- Keep AI calls and sync calls on the canonical API contract.
- Add offline queueing for generation requests where product behavior supports it.
- Test microphone interruptions, background/foreground transitions, Bluetooth
  devices, and unavailable voices.

Exit criteria:

- Native client can read/write the same logical data model.
- Speech and TTS failures degrade gracefully.
- No provider API key is shipped in the native binary.

## 8. Verification Plan

### Automated

- TypeScript typecheck.
- Contract fixture tests for every adapter.
- Schema validation tests for malformed model output.
- Migration tests for sync insert/update/delete and RLS ownership.
- Idempotency tests using the same `requestId`.
- Property tests for chunk normalization and semantic-group assignment.

### Manual beta scenarios

1. New user with no cloud configuration.
2. Existing user using Apps Script.
3. User with Supabase anonymous session.
4. User generates while network is interrupted.
5. User links Google after generating local data.
6. User restores on a second device.
7. Two devices update the same progress record.
8. User denies microphone permission.
9. Device has no requested TTS voice installed.

## 9. Rollback Rules

- Disable Supabase generation with a feature flag.
- Keep local generated data; never roll back or delete it automatically.
- Stop cloud sync independently from AI generation.
- Preserve request and contract versions for debugging.
- Do not migrate or delete AppScript data until restore and fallback tests pass.
