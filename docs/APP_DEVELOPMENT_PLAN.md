# ChunkDiary — Detailed App Development Plan
Version: 1.4 | Date: 2026-10-10 | Project: GSA P-493D | Status: DEVELOPMENT FIRST / FINAL MERGE ONLY

## 0. Decisions, boundaries and baseline

### Human correction — No migration or merge into `main` during development

**Two distinct activities MUST NOT be conflated:** (1) building and testing app features on `codex/supabase-app`, including isolated synthetic data-compatibility tests; and (2) the *final* integration of the completed app into `main`. **Activity (2) is forbidden until ALL M0–M8 product features, integration tests, security/privacy checks and Reviewer acceptance are complete, AND Human gives a separate explicit approval.** No intermediate migrations, merges, cherry-picks or production deploys for app features. Existing `main` stays the untouched live beta throughout development.

**Execution order:** develop the new app end-to-end on `codex/supabase-app` → finish every intended feature (multilingual domain, AI backend, voice, accounts, real backup/restore, cloud sync, UI) → test and review the *complete app* on isolated staging/CI → obtain Human approval → perform **one final** merge/replacement into `main` and release. Source-compatibility and mock same-origin tests are *test-only*, **not** a migration, release rehearsal, or milestone allowing early update to `main`.

**Priority correction:** M1's early compatibility tooling is sufficient as a baseline for now. Stop spending development iterations on beta-to-dev cutover rehearsals, origin switching, or release choreography during M2–M7 unless a real app defect demands a targeted regression. Implement the app itself first. The **final full cutover rehearsal belongs at M8 only**, once app implementation is complete.
- **Development integration branch**: `codex/supabase-app`. All new-app work integrates here; short-lived task branches only if isolation is essential, merged promptly. Do not accumulate disconnected commits/branches.
- **Stable beta / production**: `main` remains **unchanged throughout the ENTIRE app development cycle** (baseline inspected: `a5be5a8c11b34e36396564b5f88fd915d9670af7`, tag `beta-stable-2026-10-10`). Only when all app functionality is finished, integrated and tested, Reviewer has accepted the final release, and Human explicitly approves, make **one final merge/replacement into `main`**. Do not use M1/M7 completion, CI PASS for an individual Job, or partial beta-compatibility rehearsals as permission to merge/deploy.
- **Source of truth**: source code and this plan on `codex/supabase-app`; GSA Project/Job Memory records are progress/evidence indexes. Do not implement a separate beta transition branch or backport app features to `main` before release. If production requires an urgent independent hotfix before cutover, scope and authorize it separately, then explicitly reconcile compatible changes into the app branch.
- **Product**: local-first multilingual chunk-based learning, Supabase as optional cloud identity/sync and new AI backend; future native iOS/Android share data contracts and backend with web.
- **Platform phase boundary (Human decision 2026-10-10)**: current implementation and release are **browser Web** (desktop and mobile browser, including browser-managed mic permission and browser speech APIs). Offline TTS/voice availability, native OS microphone permissions, background audio, audio-session interruptions and installed native voices belong to a **separate later Native App phase**, not Web CP5/CP8. Browser speech can be network-dependent; do not promise offline speech.
- **Absolute invariants**: (I1) same-origin old beta data remains readable without registration, (I2) no deletion/reset/ID regeneration/loss of training stats in automatic migration, (I3) prompts private at runtime and absent from public frontend/source artifact, (I4) never upload raw diary/corpus without explicit product consent, (I5) user can **only choose a voice** in voice UX—no speed/pitch/quality controls; voice/accent is a property of chosen voice, (I6) cloud failure never prevents local learning.
- **Known exposure**: public branch/history contains legacy generation prompts in **all three surfaces**: `supabase/functions/generate-chunks/index.ts`, `docs/app script/code.gs.txt`, and root `server.ts` (Gemini and OpenAI-compatible paths). Inventory every other source, test fixture, generated artifact, deployment and error path. Removing current source cannot retract Git history; assume old prompts disclosed and introduce new private prompt revisions. Review historical provider secrets separately.

## 1. Existing system inventory (read-only findings)
- Web: React + TypeScript + Vite; story-generation in `src/components/story_chat/StoryChatView.tsx` and `src/utils/aiService.ts`.
- `LanguageChunkDiaryDB` v4 stores: `diaries`, `meaningUnits`, `chunks`, `semanticGroups`, `settings`, `englishChunks`, `userProgress`.
- `StoryChatDB` v1 holds sessions; relevant `localStorage` data also exists.
- Original user learning stats are mutated on `chunks`; `userProgress` alone is NOT a complete learning backup.
- Supabase scaffold includes Auth anonymous session, `user_settings`, `user_progress`, `sync_snapshots`, `generated_chunk_corpus`, and `generate-chunks` Edge Function. RLS for corpus currently lacks UPDATE while client uses upsert. Full snapshot/restore and durable retry are not finished.
- `tts.ts` presently picks first matching browser voice and forces rate 0.85; `VoiceInput.tsx` is hardcoded to `vi-VN`. Speech scoring estimates text-match, not acoustic pronunciation quality.
- Existing prompt/response assumes English pivot and `englishNarrative`. English pivot must be preserved for legacy records, but must NOT be a mandatory translation hop for every target language.
- **Direct cutover supersedes the old transitional beta plan** (Human decision 2026-10-10). See `docs/migration/BETA_TRANSITION_DESIGN.md`, now revised as direct-release migration guidance. Current beta keeps its Apps Script unchanged until replacement; **no beta account/sync intermediate release, no separate `codex/beta-account-sync` branch, no mandatory 7-day notice**.
- **CR evidence**: GSA `VERIFICATION/01a124b6-b154-7908-b376-f97d75c49650.json` independently found 2 CRITICAL and 3 IMPORTANT findings; one offline-native finding is explicitly deferred by Human. The 4 active findings must have owner/surface/test proof before the replacement plan may be declared reviewed.

## 2. Target architecture and contracts
```
Web React (now) / iOS + Android (later)
  ├── Language-neutral Domain + LanguagePack registry
  ├── Local Repository (IndexedDB now / native SQLite adapter later)
  ├── AudioService: listVoices / preview / speak / stop / pickVoice
  │     ├── Browser Web Speech voices / browser-supported playback (current)
  │     ├── Optional quota-controlled Cloud Neural TTS (current Web fallback)
  │     └── Native iOS AVSpeechSynthesizer / Android TextToSpeech (future phase only)
  ├── SpeechRecognitionService (independent from TTS)
  ├── AIClient (canonical versioned request/response)
  └── CloudSync client with consent + offline queue
                    │
              Supabase Edge API
                ├── auth + quota + input validation
                ├── private prompt loader + model adapter (no prompt in response/log)
                ├── output validation + idempotency
                └── user-scoped backup / sync (RLS)
```
- Define `LanguageProfile`: normalized BCP-47 code, optional script and region/accent, display label, supported voice set, phonetic notation rules, learning-level framework, tokenizer/normalizer strategy.
- **UX_FIRST (Web)**: specify behavior/permissions and identity/privacy states before implementing UI; reuse existing Settings/onboarding/Story Chat shell. Temporary browser UI: voice chooser + preview, backup status, account identity/guest ownership confirmation, distinct AI-processing notice and sync opt-in. Any material unapproved consent/account interaction gets Human review before UI code. Frontend Jobs require `ui-coder-frontend` skill.
- Define canonical `SemanticUnit` using source-language text and meaning; target-language chunks attach locale, script, phonetic entries, optional pivots. Keep `englishPivot` / `englishNarrative` as legacy-compatible optional metadata. **Do not remove fields from historical records.**
- A single `VoicePreference` per learning language/locale stores selected provider + stable voice identifier; never persist a requested speed/pitch/quality setting. On unavailable voice, silently fallback to an available correct-language voice with a compact nonblocking notice.
- **Local identity boundaries**: treat the beta v4 DB/StoryChatDB/localStorage as legacy unclaimed local data until ownership is established. Define isolated logical workspaces for local guest and for each authenticated identity (prefer distinct scoped local repositories/DBs with original logical IDs retained, subject to M1 feasibility spike); preserve the untouched legacy data as import source. Unclaimed legacy data remains visible offline without account. No implicit assignment to the currently signed-in Supabase user. Explicitly choose/copy/merge into one account only on consent with record-count preview and rollback.
- **Account lifecycle**: account A ↔ B switching must hide prior user's diaries, StoryChat sessions, settings, voice choices and unsent queue from UI, backups and model inputs; logging out switches to local guest workspace without deleting any data. Asynchronous uploads and restores bind to origin identity and cancel/discard stale results on identity switch; owned records are never silently imported into another account. Test multi-tab switching and cross-account same-ID records.
- **Cloud record identity**: for row-per-record tables, use **user-scoped uniqueness**, e.g. `(user_id, id)` composite primary/unique key, and explicit Supabase `onConflict: "user_id,id"`. Preserve original local record id within scope, never rewrite unrelated users' rows or use a global `id` PK. Plan migration of existing tables and RLS as one verified staged change; account-owned backup snapshots key by user id.
- All backend contracts versioned (schema, request, prompt, migration, language pack). Voice and account interfaces must not import React UI components.

## 3. Implementation milestones and task dependencies

### M0 — Baseline, reconciliation and test foundation (first; CP0)
Tasks:
- M0.1 Freeze exact main beta data schema, representative sanitized export fixtures from each existing store and StoryChatDB, locale/profile combinations, sample old and recent records; record branch head/commit.
- M0.2 Build hermetic **read-only compatibility and contract** tests with negative controls to prove a real defect is caught; require reviewer to inspect test script at CP0. This does NOT authorize any migration to `main`.
- M0.3 Define canonical API contracts, branch integration policy, staging Supabase identity/secret separation and no-production-touch safeguards.
- M0.4 Freeze explicit identity model: legacy-unclaimed local workspace, unlinked guest, signed-in account scopes, safe guest adoption preview/confirmation, logout/switch semantics, cross-tab pending operations and storage namespace decision; inspect existing on-device ownership evidence before binding anything. Use a small feasibility spike on real v4 fixture before confirming a local DB namespace strategy.
- M0.5 Define privacy processing matrix: user-triggered AI generation sends diary text to a third-party model; clear upfront processing disclosure (recipient, purpose, retention/abuse handling) and explicit user action, independent from optional persistent cloud backup and corpus-sharing consent. Choose provider terms/retention before enabling; default provider request/log redaction.
Outputs: baseline fixture pack with counts/hash/manifests; `docs/contracts/*`; reproducible test commands and evidence.
PASS: baseline known, all fixture formats load, negative-control test rejects invalid mutation; no changes to production.

### M1 — New-app storage design and data compatibility (depends M0; CP1)

**Scope clarification:** M1 implements new-app persistence, internal backup/restore primitives and preservation of legacy data shape **on the development branch only**. It does **not** migrate/release code into `main`, transfer real beta users to cloud, or replace production. Further repeated cutover simulations are deferred to M8.
Tasks:
- M1.1 Audit all persistence code incl. `src/db/indexedDb.ts`, `src/db/userDb.ts`, `src/db/userProgressDb.ts`, `StoryChatDB`, localStorage; enumerate relation and ownership graph.
- M1.2 Add additive reader/normalizer with `schemaVersion`, field defaults, unknown-field preservation for backup; maintain stable IDs, timestamps, `stars`, `timesPracticed`, ratings, semantics, session data.
- M1.2a Implement **identity-scoped local repository** for the new app and read-only legacy import; preserve original logical record keys and all stats, even when two accounts hold identical IDs. Keep legacy v4/StoryChatDB intact through verified claim/copy. Unclaimed guest data may be used without login. Data previously owned by Account A is never visible to B or auto-adopted on sign-in. Consider per-account DBs (opaque non-PII scope) to avoid global key collisions; choose after fixture feasibility test, not by changing key paths destructively.
- M1.3 Prefer keep IndexedDB v4 when adding JSON-object fields. If stores/indexes require version increment, implement and test upgrade **and rollback limitations**: older beta may throw VersionError on higher-version DB; require compatible rollback build or pre-upgrade full export/recovery. Never delete/recreate stores automatically.
- M1.4 Implement comprehensive export/import/snapshot **inside the selected identity scope** with version, per-store count, checksum, transaction validation, dry-run diff, legacy-claim consent and deterministic merge conflict rules. Exclude auth tokens/secrets. Verify completion before showing Backed up. A backup/restore must not merge Account A's data into B's scope without explicit user-controlled import flow.
- M1.5 Specify origin-bound storage compatibility and a future optional export/import path for users of another origin. **Implement user-facing recovery features as part of the new app; defer any real origin migration or beta retirement activity to final M8 release preparation.** Redirect alone cannot transfer IndexedDB.
PASS: same-origin main v4 fixture opens without account; CRUD/reload/new chunks do not alter old IDs/stats; blank/newer cloud never erases local; full cross-device restore preserves counts, relations, StoryChat session and settings; offline/network-failure safe. Additional negative scenario: same device guest/Account A/Account B with overlapping logical IDs switches without cross-display, cross-sync, or overwrite; unknown old data remains unclaimed until confirmed.

### M2 — Multilingual domain + private language modules (depends M0 and M1 contract; CP2)
Tasks:
- M2.1 Remove English-specific assumptions from domain, validators, UI, story voice input. Source language and target language must be first-class; English pivot optional, retained on legacy objects.
- M2.2 Language packs contain code/region/script/notation/normalization/segmentation/level rules; no hardcoded English-as-target or `vi-VN` input for every user.
- M2.3 Initially verify: Vietnamese→English, Vietnamese→Chinese (Mandarin Simplified), Vietnamese→Japanese and Vietnamese→Korean, plus one Latin non-English target (e.g. French or Spanish); architecture supports expansion. Record coverage limits clearly; do not advertise unsupported dialects.
- M2.4 Pronunciation metadata: IPA where appropriate, Pinyin with tones for Mandarin, kana/furigana and optional romaji for Japanese, Hangul and optional romanization for Korean. Validate script/locale and display fallback; do not force non-Latin output into generic IPA slots.
- M2.5 Separate content-match score from acoustic pronunciation assessment; old score remains interpretable without mislabeling it as a calibrated phoneme score.
PASS: 20+ consent-safe bilingual fixtures per launch language, with numbers, names, neutral/professional contexts, punctuation, long/short entries; no invented facts; no regression on English beta.

### M3 — Private prompt backend & AI contract (depends M0, M2; CP3)
Tasks:
- M3.1 Inventory **every prompt entry point**: `supabase/functions/generate-chunks/index.ts`, `docs/app script/code.gs.txt`, both Gemini and OpenAI-compatible paths in root `server.ts`, development/mock configurations, test data, build/deployment outputs and public git history. Mark old versions disclosed; create **new** private versioned prompt assets outside public Git in a backend-only store with restricted access; source repo contains only loader, prompt id/version and output contract. A published source repository must not include new private prompt text.
- M3.2 Prompt composition server-side: language-neutral semantics + target-language rules + provider-independent validated input. Client sends ONLY user content/settings; never full prompt or authority-bearing model/system instructions. Ensure no new private prompt in bundle, response, errors, telemetry, snapshots or client-accessible storage. Deprecate or secure the legacy Express paths rather than overlooking them; no claim that public historical prompts can be made secret again.
- M3.2a Distinguish **AI_PROCESSING** (diary transmitted on explicit Generate action for model processing, visible disclosure and verified provider retention policy) from **BACKUP_SYNC** (persistent user-owned cloud copy, independently opted into) and **CORPUS_SHARE** (separate optional consent, OFF by default). Never use one consent to authorize all three; no raw diary text in client/server logs or diagnostics.
- M3.3 Establish `GenerateChunksRequest/Response` version 2 with backward adapter for beta. Strict bounds for diary length, semantic-group count, token budget, required fields and chunk counts (one common, at most one personalized for each unit). Protect semantics, no inventions, conservative professional personalization.
- M3.4 Implement auth/authorization and provider key separation; do not confuse Supabase publishable key with service key. Use requestId for idempotent retry, timeout, stable error codes, version tracking without logging raw diary.
- M3.5 Add contract mock, malformed output, prompt-injection, forced errors and leakage scans across **all prompt sources including `server.ts`**, current public source, built frontend, network traces, provider errors and logs; historical public content is marked disclosed, not claimed retractable. Verify network capture separates transient AI-processing transfer from persistent sync/corpus requests; failed requests and retries never log diaries.
PASS: no new private prompt content in public artifacts; no prompt or provider secrets in client traffic; AI semantic/locale checks PASS; invalid generation never partially persists local data.

### M4 — Production-capable Supabase AI (depends M3; CP4)
Tasks:
- M4.1 Bring `supabase/functions/generate-chunks/index.ts` into parity with canonical contract; Edge validates JWT identity, input, per-user quota and output; returns object not JSON-as-string.
- M4.2 Compare selected real representative diary inputs with legacy Apps Script outputs under consented test data; reviewer judges meaning, semantic-unit coverage, terminology, language naturalness, phonetics.
- M4.3 Test Supabase generation in local/staging and a controlled nonproduction preview against the existing Apps Script beta as read-only quality reference; **do not deploy an interim Apps Script-to-Supabase hybrid beta**. At the authorized direct cutover, new app uses Supabase generation; retain old beta deployment only as a separately tested recovery option. Ensure no double paid calls on retry.
- M4.4 Test latency/errors, malformed/empty responses, rate limits, service failure, cancellation; local stories survive failures.
PASS: schema + quality evaluation PASS, staging quota enforced, rollback switch tested, no changes to production.

### M5 — Browser Web voice quality, native-compatible interface (depends M2; CP5)
**Phase scope:** Web browser only. Browser-managed microphone permission and browser speech recognition remain in scope for Web integration; offline voice and all native OS speech/mic permission lifecycles are expressly deferred. Implement portable interfaces but not native adapters or offline TTS capability discovery.
Tasks:
- M5.1 Extract platform-agnostic `AudioService` interface and web adapter from `src/utils/tts.ts`; fix asynchronous voices load, stable identifiers, correct locale, Unicode text handling, cancellation/state races, select only voices available on current platform.
- M5.2 **UX has exactly one adjustable voice choice.** The choice list may SHOW voice name, accent/locale and descriptive timbre; preview each entry. Do NOT expose separate accent, speed, pitch, playback quality, Neural/System toggles or rate sliders. Use engine's natural speed.
- M5.3 Prefer best available free **browser-exposed** voice for the user's language; availability/quality depend on current OS/browser and may require network. Evaluate cloud Neural TTS (Google Cloud Chirp 3 HD/Neural2 vs Azure) only as an internal backend fallback, requiring actual per-language listening tests and cost/terms verification before selecting provider.
- M5.4 Cloud TTS uses auth, quota + hard monthly cost/character gate, cache only within licensing/privacy terms, no exposed API key, no duplicate synthesis on repeat; when budget is exhausted fallback to an available browser voice. If neither is available, show a clear, nonblocking audio-unavailable state and continue text learning. Never assume cloud is free without limits.
- M5.5 Define **interfaces only** for future iOS `AVSpeechSynthesizer` and Android `TextToSpeech`; document future native voice enumeration, platform permission flow and installed offline voice handling as deferred implementation. Do not implement or test native OS TTS/mic lifecycle in this Web phase.
PASS: listen/preview/switch works on desktop browsers and mobile browsers (iOS Safari / Android Chrome where available); show alternative voices/accent only when actually available; failed/unavailable browser voice or cloud quota gracefully preserves text learning; no paid requests beyond configured cap; exactly one voice setting in UI. **No offline voice PASS requirement for Web.**

### M6 — Auth, full cloud sync, consent and security (depends M1, M3; CP6)
Tasks:
- M6.1 Use dedicated ChunkDiary Supabase staging project, never reuse unverified project. Auth anonymous optional, Google/email linking and account-switch identity handling; test account linking retains ownership.
- M6.2 Implement full encrypted-in-transit (TLS) **identity-scoped** backup/restore of approved stores and preferences. Persistent diary backup, generated-corpus sharing and transient AI-processing disclosure are **separate** product flows; corpus sharing default OFF. Anonymous session is not a guarantee of cross-device recovery without linked identity.
- M6.3 Queue changes durably with pending/synced/failed state, retry/backoff, idempotent upserts and conflict resolution based on provenance/revision rather than blindly overwriting newer local. Queue entries MUST persist owner identity and authorized consent scope; on account switching/sign-out, abort in-flight requests and forbid retries under a new session. Stats in `chunks` authoritative; avoid stale `userProgress` overwrite.
- M6.4 RLS for all exposed tables, ownership checks for SELECT/INSERT/UPDATE/DELETE, service permissions least privilege. **Replace global text PK** in `user_progress` and `generated_chunk_corpus` with user-scoped uniqueness e.g. `PRIMARY KEY(user_id,id)` (or equivalent explicit unique key), preserving existing row ownership/IDs; pair with `upsert(..., { onConflict: "user_id,id" })`. Fix corpus UPDATE policy for upsert or implement a tested insert-only contract. Run collision fixtures with the same `id` in two accounts and confirm both can independently insert/select/update; verify attempted cross-owner writes denied. Migration SQL changes ONLY on staging until separately authorized.
- M6.5 Test two users/two devices, different identities on same browser **sharing identical imported record IDs**, logout, interrupted guest adoption, multi-tab identity change, orphaned pending queue, expired tokens, interrupted link, offline edits, quota, failed restore, double retry; snapshot restore must be reversible.
PASS: full backup/restore and two-device sync complete without data loss or cross-user access; RLS verified on live staging DB; no silent data upload; fail-safe local experience.

### M7 — User-facing UX & direct replacement readiness (depends M1, M5, M6; CP7)
Tasks:
- M7.1 Account screen: Local only / Pending / Backed up / Failed, Google/email link, manual sync, backup/restore with integrity status. Avoid implying sign-in alone implies backup. Identity switch must hide former account workspace; first claim of unowned beta data offers a transparent preview, consent and cancel option without deletion; show privacy disclosure before first AI generation and explicit independent backup/corpus opt-ins.
- M7.2 Language selection according to LanguagePack support; voice choice + preview only (no speed/quality/accent selector); persist choice per learning language and platform availability.
- M7.3 Finish and accept all account/backup/restore/consent UX **exclusively inside `codex/supabase-app`**, using dev/test fixtures. Do not create `codex/beta-account-sync`, modify production `main`, execute real user migration, or run release cutover during M7. Only after M8 **full-app** integration, test and Reviewer approval plus Human release authorization may the complete app replace `main` and production. No forced account/data-migration gate or mandatory seven-day notice.
- M7.4 Test no-account reading of old data; no forced re-onboarding; no wipe on day 7; user-facing migration wording accurate.
PASS: simulate **direct same-origin replacement** from old beta build to the new app using a real persisted v4 dataset, without intermediate beta release, without signup, and without losing identity/session/progress; export/import or verified bridge for prior **different-origin** users remains optional and separate. Account/Backup/Voice UX accepted; no production change without separate approval.

### M8 — Integrated E2E, hardening, native handoff and release (depends M4, M6, M7; CP8)
Tasks:
- M8.1 Reviewer audits code **and test scripts** at checkpoints; red/green negative controls, realistic datasets, browser/device QA, security checks, parity fixtures and build.
- M8.2 Real staging Supabase + Vercel preview tests for existing beta and new users, English + other launch languages, **browser** microphone permission (allow/deny/retry where supported), Web Speech recognition, browser voice availability/fallback, sync failure and recovery; no native OS mic/offline-audio tests. Explicit identity-isolation and identical-ID cross-user cases, stale cloud sync queue on switching, and AI-processing privacy network traces are mandatory.
- M8.3 Measure data integrity (IDs/counts/stats/checksums), AI quality, TTS listening quality, P50/P95 latency, token/TTS cost, retry rates, consent and privacy. Record explicit acceptance evidence and unresolved items.
- M8.4 Prepare a **single direct cutover** (not staged beta changes): verify exact new release build on Vercel preview and correct isolated Supabase staging backend, replay real main-v4 same-origin fixture then rehearse full replacement. Obtain explicit Human release approval, then merge/replace `main` with the tested app version and switch the production deployment at existing `https://chunk-diary.vercel.app`. Verify post-release load, auth, AI and data checks. Retain the previous beta deployment as a recovery target, but first test that reverting the frontend can still read any upgraded local DB (IndexedDB VersionError risk) and preserve post-cutover data; use compatible rollback build/export/recovery instead of deleting data. No production change in planning.
- M8.5 Native handoff **specification only** (shared domain/contracts, local repository + audio adapters, auth deep link/callback); implementation of iOS/Android binaries, native microphone permissions, audio sessions/interruptions/background behavior, platform STT/TTS, installed/offline voices and native-device QA is a later separately approved phase, explicitly **out of scope** of this Web release.
PASS: all CP0–CP8 evidence attached, no critical/open data or prompt leakage bugs, real regression tests PASS, human approves release and production cutover.

## 4. File/change map (planned, no code changes in this planning step)
- `src/types.ts`, `src/db/*`, `src/components/story_chat/db/storySessionDb.ts`: versioned domain + migration/backup.
- New `src/domain/language/*`, `src/domain/contracts/*` or comparable modules: LanguagePack, AI model, normalization, pronunciation metadata.
- `src/utils/aiService.ts`, `src/components/story_chat/StoryChatView.tsx`: canonical AI adapter; atomic local writes; locale-aware flow.
- `src/utils/tts.ts`, new `src/services/audio/*`, `src/components/SettingsView.tsx`, `src/components/PracticeGameView.tsx`: voice listing, preview, persistence, fallback, no speed UI.
- `src/components/story_chat/components/VoiceInput.tsx`, `src/utils/speech.ts`: correct language capture and honest scoring labels.
- `src/services/supabase/*`, `src/services/storage/*`, `supabase/migrations/*`: Auth, consent, sync queue, full snapshot and RLS.
- `supabase/functions/generate-chunks/*`, **root `server.ts`**, `docs/app script/code.gs.txt`: complete legacy prompt exposure inventory, replace/retire public generation prompt routes, server-only new prompt reference, validation, quota and provider boundary.
- `docs/ai/*`, `docs/migration/*`, `docs/contracts/*`, `tests/*`: implementation specification, fixture/evidence and acceptance commands.
- Private prompt assets **must NOT be committed** to the public repository. Any historical prompt remains disclosed.

## 5. Formal acceptance / evidence matrix
- DATA-01: open pristine `main` v4 DB without login; 100% fixture IDs and record counts retained.
- DATA-02: deep stats (stars, review timestamps/ratings/times) equal before/after migration.
- DATA-03: same-origin reload + new diary/chunk + existing practice run; all old relations valid.
- DATA-04: full export/import clean browser; per-store checksums and foreign key-like relations match.
- DATA-05: power/network interruption mid-sync + retry; latest local data preserved; no duplicate rows.
- DATA-06: higher IndexedDB version rollback tested with suitable backward-compatible build or explicit pre-upgrade recovery path.
- DATA-07: account A, account B and unclaimed beta guest on **same browser** retain isolated library, StoryChat session, settings and pending queues, including identical legacy IDs; switch, logout, restore and delayed request never leak/overwrite.
- DATA-08: claiming previously unowned beta data requires an explicit preview/confirmation; cancelling leaves original local data intact; repeat import is idempotent.
- PRIV-01: **new private prompt versions** absent from current public source including `server.ts`, Edge Function and legacy docs, frontend bundle, network responses and logs. Historical published prompts remain disclosed; do not assert retroactive secrecy.
- PRIV-02: raw diaries not uploaded for persistent backup/corpus without **independent** explicit opt-ins, with corpus OFF by default.
- PRIV-03: client explains transient third-party AI processing of diary content before first generation; explicit Generate action authorizes only processing, not storage/corpus. Verify provider retention/log policy and network traces, no raw diary in error/telemetry.
- SEC-01: staging RLS cross-user SELECT/INSERT/UPDATE/DELETE denied; authorized owner upsert succeeds.
- SEC-02: identical local IDs can coexist across two cloud accounts via `(user_id,id)` or equivalent keys, with correct upsert conflict target, row ownership, and no cross-user mutation.
- AI-01: one common + max one personalized per semantic unit; meaning preserved; hallucination rejection.
- AI-02: English, Mandarin, Japanese, Korean + one additional Latin target pass supported language test fixtures.
- AI-03: malformed/untrusted provider output rejected atomically; no prompt returned in errors.
- VOICE-01: only voice choice shown, supports preview, accent through voice identity; no speed/quality/pitch UI.
- VOICE-02: desktop/mobile **browser** voice selection, preview, failed/unavailable voice fallback and hard cloud quota cap tested. Offline TTS and native microphone/voice behavior explicitly deferred to Native phase.
- ACC-01: guest→linked identity and second-device restore without data loss; switch user does not expose previous account.
- REL-01: **direct cutover rehearsal** old beta → new app at same origin (no beta transition release), full E2E on Vercel preview + staging backend, Reviewer validation of test scripts, safe rollback/bridge instructions and explicit Human cutover approval.
- REL-02: before replacement, confirm old and new apps share the **same origin** for transparent IndexedDB reuse; if prior users exist at a different origin, prepare their separate voluntary export/import/bridge path. Preserve backup/recovery options without modifying current production during development.

## 6. Critical path, workflow and checkpoints
Critical path: M0 → M1 → M2 → M3 → M4 → M8. M5 runs after M2 and may progress alongside M3/M4; M6 starts after M1 and M3; M7 follows M1/M5/M6. Every milestone has one checkpoint CP0–CP8 with real source/evidence hashes. Run focused tests per task; broader reviewer checkpoints at contract changes, DB changes, prompt boundary, security and release—not every trivial commit.
GSA Planner manages scoped jobs within this plan; Tester provides execution evidence; Reviewer independently inspects code/test validity. Do not equate an unexecuted checklist with PASS. CR is requested explicitly by Human when needed.

## 7. Release, privacy, budget and failure handling
- Do not deploy preview on every commit; local and staging tests first, reserve Vercel preview for realistic integration gates.
- Separate staging vs production Supabase project, keys, prompt store and analytics; audit env variables and token leakage.
- Web Cloud TTS is optional; implement hard cap and browser-voice/text fallback rather than assuming free indefinitely. Web availability depends on browser, device and network; native/offline voice selection will be assessed in a later Native phase.
- Structured operations logging only: request ID, contract/prompt version, error category, metrics and timing; never diary text, private prompt, credential, full provider error or raw audio without consent.
- Keep production `main` untouched through development. **Only after** full E2E, security/privacy/data release gates and explicit Human approval, perform one controlled final merge/replacement of `main` and production deployment. No intermediate beta feature patch, seven-day staging countdown or forced user migration. No production RLS deployment or DNS change without separate authorization and verified rollback/restore evidence.

## 8. Pending decisions to resolve within M0 (not implementation blockers)
- Which launch languages are fully supported vs marked experimental, and human language reviewers/fixtures.
- Supabase staging project identity and authorization; cloud provider pricing/license confirmations.
- Cloud diary backup consent scope/retention policy and TTS audio-cache licensing.
- Where to host private versioned prompts (Edge secret store for simple deployment vs separately restricted private repository/store for version history).
- Real-user beta fixture availability with opt-in and sanitization; never copy identifiable diaries into public tests.

**CR disposition v1.2 (2026-10-10):** CR-01 local-account isolation → M0.4/M1.2a/M6.3/M6.5/M7.1, DATA-07/08. CR-02 global SQL ID conflict → M6.4, SEC-02. CR-03 `server.ts` prompt exposure → M3.1/M3.5 and file map, PRIV-01. CR-04 AI processing vs persistent backup consent → M0.5/M3.2a/M6.2/M7.1, PRIV-02/03. CR-05 offline voice → **DEFERRED**, independent Native phase as explicitly instructed by Human (no Web release gate). These are planned remediations, **not implemented fixes**; each requires execution evidence and Tester/Reviewer checks at CP1, CP3, CP6 and CP8.

**Traceability / ownership:** CR-01 owner M1 (local repository) + M6 (Auth/Sync); CR-02 owner M6 (SQL/RLS); CR-03 owner M3 (AI privacy); CR-04 owner M3 (privacy contract) + M6 (sync) + M7 (UX notice). M0 freezes evidence/consent/identity contracts first. No other repository write scope. Phase Web = UX_FIRST, reuse current shell for temporary UI; frontend tasks require ui-coder-frontend. Changes to consent texts, legacy data assignment or production cutover are Human Gates.

**Release decision v1.4 (Human correction 2026-10-10):** first finish building the **entire new app**, then finish comprehensive testing/review, **then and only then** perform the one authorized final integration into `main`. M0/M1 synthetic beta data compatibility tests and backup/restore primitives are ordinary development tests/features, NOT a request to migrate the branch or production. Prior release-routing language that could be interpreted as migrating during development is superseded.

**Document scope**: actionable master roadmap. It does not authorize implementation, deployment or release by itself.
