# ChunkDiary — Detailed App Development Plan
Version: 1.0 | Date: 2026-10-10 | Project: GSA P-493D | Status: PLANNED / NOT IMPLEMENTED

## 0. Decisions, boundaries and baseline
- **Development integration branch**: \`codex/supabase-app\`. All new-app work integrates here; short-lived task branches only if isolation is essential, merged promptly. Do not accumulate disconnected commits/branches.
- **Stable beta / production**: \`main\` (baseline inspected: \`a5be5a8c11b34e36396564b5f88fd915d9670af7\`, tag \`beta-stable-2026-10-10\`). No production deployment, promotion or merge without release gate and user approval.
- **Source of truth**: source code and this plan in the registered repository; GSA Project/Job Memory records are progress and evidence indexes. After any hotfix to \`main\`, explicitly reconcile into \`codex/supabase-app\`.
- **Product**: local-first multilingual chunk-based learning, Supabase as optional cloud identity/sync and new AI backend; future native iOS/Android share data contracts and backend with web.
- **Absolute invariants**: (I1) same-origin old beta data remains readable without registration, (I2) no deletion/reset/ID regeneration/loss of training stats in automatic migration, (I3) prompts private at runtime and absent from public frontend/source artifact, (I4) never upload raw diary/corpus without explicit product consent, (I5) user can **only choose a voice** in voice UX—no speed/pitch/quality controls; voice/accent is a property of chosen voice, (I6) cloud failure never prevents local learning.
- **Known exposure**: existing public branch includes prompt material in \`supabase/functions/generate-chunks/index.ts\` and \`docs/app script/code.gs.txt\`. Removing it from current files does not retroactively erase public Git history. Treat old prompt as disclosed; produce a new private prompt revision without committing it to public Git; review historical secrets separately.

## 1. Existing system inventory (read-only findings)
- Web: React + TypeScript + Vite; story-generation in \`src/components/story_chat/StoryChatView.tsx\` and \`src/utils/aiService.ts\`.
- \`LanguageChunkDiaryDB\` v4 stores: \`diaries\`, \`meaningUnits\`, \`chunks\`, \`semanticGroups\`, \`settings\`, \`englishChunks\`, \`userProgress\`.
- \`StoryChatDB\` v1 holds sessions; relevant \`localStorage\` data also exists.
- Original user learning stats are mutated on \`chunks\`; \`userProgress\` alone is NOT a complete learning backup.
- Supabase scaffold includes Auth anonymous session, \`user_settings\`, \`user_progress\`, \`sync_snapshots\`, \`generated_chunk_corpus\`, and \`generate-chunks\` Edge Function. RLS for corpus currently lacks UPDATE while client uses upsert. Full snapshot/restore and durable retry are not finished.
- \`tts.ts\` presently picks first matching browser voice and forces rate 0.85; \`VoiceInput.tsx\` is hardcoded to \`vi-VN\`. Speech scoring estimates text-match, not acoustic pronunciation quality.
- Existing prompt/response assumes English pivot and \`englishNarrative\`. English pivot must be preserved for legacy records, but must NOT be a mandatory translation hop for every target language.
- Existing \`docs/migration/BETA_TRANSITION_DESIGN.md\` (2026-10-10) supersedes conflicting older transition steps; preserve beta Apps Script until the tested switch.

## 2. Target architecture and contracts
\`\`\`
Web React (now) / iOS + Android (later)
  ├── Language-neutral Domain + LanguagePack registry
  ├── Local Repository (IndexedDB now / native SQLite adapter later)
  ├── AudioService: listVoices / preview / speak / stop / pickVoice
  │     ├── Web Speech voices / device voice
  │     ├── iOS AVSpeechSynthesizer / Android TextToSpeech (future)
  │     └── Opt-in quota-controlled Cloud Neural TTS (fallback)
  ├── SpeechRecognitionService (independent from TTS)
  ├── AIClient (canonical versioned request/response)
  └── CloudSync client with consent + offline queue
                    │
              Supabase Edge API
                ├── auth + quota + input validation
                ├── private prompt loader + model adapter (no prompt in response/log)
                ├── output validation + idempotency
                └── user-scoped backup / sync (RLS)
\`\`\`
- Define \`LanguageProfile\`: normalized BCP-47 code, optional script and region/accent, display label, supported voice set, phonetic notation rules, learning-level framework, tokenizer/normalizer strategy.
- Define canonical \`SemanticUnit\` using source-language text and meaning; target-language chunks attach locale, script, phonetic entries, optional pivots. Keep \`englishPivot\` / \`englishNarrative\` as legacy-compatible optional metadata. **Do not remove fields from historical records.**
- A single \`VoicePreference\` per learning language/locale stores selected provider + stable voice identifier; never persist a requested speed/pitch/quality setting. On unavailable voice, silently fallback to an available correct-language voice with a compact nonblocking notice.
- All backend contracts versioned (schema, request, prompt, migration, language pack). Voice and account interfaces must not import React UI components.

## 3. Implementation milestones and task dependencies

### M0 — Baseline, reconciliation and test foundation (first; CP0)
Tasks:
- M0.1 Freeze exact main beta data schema, representative sanitized export fixtures from each existing store and StoryChatDB, locale/profile combinations, sample old and recent records; record branch head/commit.
- M0.2 Build hermetic migration/contract test harness, negative controls to prove test fails on known defect; require reviewer to inspect test script at CP0.
- M0.3 Define canonical API contracts, branch integration policy, staging Supabase identity/secret separation and no-production-touch safeguards.
Outputs: baseline fixture pack with counts/hash/manifests; \`docs/contracts/*\`; reproducible test commands and evidence.
PASS: baseline known, all fixture formats load, negative-control test rejects invalid mutation; no changes to production.

### M1 — Beta data compatibility & recoverable backup (depends M0; CP1)
Tasks:
- M1.1 Audit all persistence code incl. \`src/db/indexedDb.ts\`, \`src/db/userDb.ts\`, \`src/db/userProgressDb.ts\`, \`StoryChatDB\`, localStorage; enumerate relation and ownership graph.
- M1.2 Add additive reader/normalizer with \`schemaVersion\`, field defaults, unknown-field preservation for backup; maintain stable IDs, timestamps, \`stars\`, \`timesPracticed\`, ratings, semantics, session data.
- M1.3 Prefer keep IndexedDB v4 when adding JSON-object fields. If stores/indexes require version increment, implement and test upgrade **and rollback limitations**: older beta may throw VersionError on higher-version DB; require compatible rollback build or pre-upgrade full export/recovery. Never delete/recreate stores automatically.
- M1.4 Implement comprehensive export/import/snapshot with version, per-store count, checksum, transaction validation, dry-run diff and deterministic merge conflict rules. Exclude auth tokens/secrets. Verify completion before showing Backed up.
- M1.5 Reconcile origin migration: local data is origin-bound; support JSON export/import or a verified old-origin bridge for GitHub Pages users. Redirect alone is not transfer.
PASS: same-origin main v4 fixture opens without account; CRUD/reload/new chunks do not alter old IDs/stats; blank/newer cloud never erases local; full cross-device restore preserves counts, relations, StoryChat session and settings; offline/network-failure safe.

### M2 — Multilingual domain + private language modules (depends M0 and M1 contract; CP2)
Tasks:
- M2.1 Remove English-specific assumptions from domain, validators, UI, story voice input. Source language and target language must be first-class; English pivot optional, retained on legacy objects.
- M2.2 Language packs contain code/region/script/notation/normalization/segmentation/level rules; no hardcoded English-as-target or \`vi-VN\` input for every user.
- M2.3 Initially verify: Vietnamese→English, Vietnamese→Chinese (Mandarin Simplified), Vietnamese→Japanese and Vietnamese→Korean, plus one Latin non-English target (e.g. French or Spanish); architecture supports expansion. Record coverage limits clearly; do not advertise unsupported dialects.
- M2.4 Pronunciation metadata: IPA where appropriate, Pinyin with tones for Mandarin, kana/furigana and optional romaji for Japanese, Hangul and optional romanization for Korean. Validate script/locale and display fallback; do not force non-Latin output into generic IPA slots.
- M2.5 Separate content-match score from acoustic pronunciation assessment; old score remains interpretable without mislabeling it as a calibrated phoneme score.
PASS: 20+ consent-safe bilingual fixtures per launch language, with numbers, names, neutral/professional contexts, punctuation, long/short entries; no invented facts; no regression on English beta.

### M3 — Private prompt backend & AI contract (depends M0, M2; CP3)
Tasks:
- M3.1 Create **new** private versioned prompt assets outside public Git, e.g. backend-only secret/private secure store with restricted access; source repo contains only loader, prompt id/version and output contract. A published source repository must not include actual private prompt text.
- M3.2 Prompt composition server-side: language-neutral semantics + target-language rules + provider-independent validated input. Client sends ONLY user content/settings; never full prompt or authority-bearing model/system instructions. Ensure no prompt in bundle, response, errors, telemetry, snapshots or client-accessible storage.
- M3.3 Establish \`GenerateChunksRequest/Response\` version 2 with backward adapter for beta. Strict bounds for diary length, semantic-group count, token budget, required fields and chunk counts (one common, at most one personalized for each unit). Protect semantics, no inventions, conservative professional personalization.
- M3.4 Implement auth/authorization and provider key separation; do not confuse Supabase publishable key with service key. Use requestId for idempotent retry, timeout, stable error codes, version tracking without logging raw diary.
- M3.5 Add contract mock, malformed output, prompt-injection, forced errors and leakage scans across source, built frontend, network traces and logs; historical public content is marked disclosed, not claimed retractable.
PASS: no new private prompt content in public artifacts; no prompt or provider secrets in client traffic; AI semantic/locale checks PASS; invalid generation never partially persists local data.

### M4 — Production-capable Supabase AI (depends M3; CP4)
Tasks:
- M4.1 Bring \`supabase/functions/generate-chunks/index.ts\` into parity with canonical contract; Edge validates JWT identity, input, per-user quota and output; returns object not JSON-as-string.
- M4.2 Compare selected real representative diary inputs with legacy Apps Script outputs under consented test data; reviewer judges meaning, semantic-unit coverage, terminology, language naturalness, phonetics.
- M4.3 Shadow test then opt-in internal mode before activating Supabase generation. Fallback Apps Script for transition ONLY; final new app routes to Supabase only after gates PASS. Ensure no double paid calls on retry.
- M4.4 Test latency/errors, malformed/empty responses, rate limits, service failure, cancellation; local stories survive failures.
PASS: schema + quality evaluation PASS, staging quota enforced, rollback switch tested, no changes to production.

### M5 — Voice quality Web now, native-ready service (depends M2; CP5)
Tasks:
- M5.1 Extract platform-agnostic \`AudioService\` interface and web adapter from \`src/utils/tts.ts\`; fix asynchronous voices load, stable identifiers, correct locale, Unicode text handling, cancellation/state races, select only voices available on current platform.
- M5.2 **UX has exactly one adjustable voice choice.** The choice list may SHOW voice name, accent/locale and descriptive timbre; preview each entry. Do NOT expose separate accent, speed, pitch, playback quality, Neural/System toggles or rate sliders. Use engine's natural speed.
- M5.3 Prefer best matching free device voice. Evaluate cloud Neural TTS (Google Cloud Chirp 3 HD/Neural2 vs Azure) only as an internal backend fallback, requiring actual per-language listening tests and cost/terms verification before selecting provider.
- M5.4 Cloud TTS uses auth, quota + hard monthly cost/character gate, cache only within licensing/privacy terms, no exposed API key, no duplicate synthesis on repeat; when budget exhausted fallback to device voice. Never assume cloud is free without limits.
- M5.5 Native adapter contract for future \`AVSpeechSynthesizer\` and Android \`TextToSpeech\`; enumerate actual installed voices, preserve choice per language when possible, fallback safely; do not promise unrestricted Siri voices.
PASS: listen/preview/switch works in Web desktop + iOS Safari/Android Chrome coverage; at least two meaningfully different voices/accent when platform provides them; system fallback works offline; no paid requests beyond configured cap; exactly one voice setting in UI.

### M6 — Auth, full cloud sync, consent and security (depends M1, M3; CP6)
Tasks:
- M6.1 Use dedicated ChunkDiary Supabase staging project, never reuse unverified project. Auth anonymous optional, Google/email linking and account-switch identity handling; test account linking retains ownership.
- M6.2 Implement full encrypted-in-transit (TLS) user-scoped backup/restore of approved stores and preferences. Consent for diary/corpus upload is explicit and separate. Anonymous session is not a guarantee of cross-device recovery without linked identity.
- M6.3 Queue changes durably with pending/synced/failed state, retry/backoff, idempotent upserts and conflict resolution based on provenance/revision rather than blindly overwriting newer local. Stats in \`chunks\` authoritative; avoid stale \`userProgress\` overwrite.
- M6.4 RLS for all exposed tables, ownership checks for SELECT/INSERT/UPDATE/DELETE, service permissions least privilege. Fix corpus UPDATE policy for upsert or replace the operation with an allowed insert-only contract. Handle account isolation and privilege misuse.
- M6.5 Test two users/two devices, different identities on same browser, expired tokens, interrupted link, offline edits, quota, failed restore, double retry; snapshot restore must be reversible.
PASS: full backup/restore and two-device sync complete without data loss or cross-user access; RLS verified on live staging DB; no silent data upload; fail-safe local experience.

### M7 — User-facing UX + beta transition (depends M1, M5, M6; CP7)
Tasks:
- M7.1 Account screen: Local only / Pending / Backed up / Failed, Google/email link, manual sync, backup/restore with integrity status. Avoid implying sign-in alone implies backup.
- M7.2 Language selection according to LanguagePack support; voice choice + preview only (no speed/quality/accent selector); persist choice per learning language and platform availability.
- M7.3 For current beta, prepare **isolated** transition from stable main: account and backup bridge, 7-day notice starting **actual deployment date**. Keep Apps Script for beta AI during transition. Create short-lived \`codex/beta-account-sync\` from stable baseline ONLY if needed, merge after tests; reconcile resulting main updates back into development branch.
- M7.4 Test no-account reading of old data; no forced re-onboarding; no wipe on day 7; user-facing migration wording accurate.
PASS: end-to-end old-beta-to-new-app via same origin and export/bridge; Account/Backup/Voice UX accepted; no production change without separate approval.

### M8 — Integrated E2E, hardening, native handoff and release (depends M4, M6, M7; CP8)
Tasks:
- M8.1 Reviewer audits code **and test scripts** at checkpoints; red/green negative controls, realistic datasets, browser/device QA, security checks, parity fixtures and build.
- M8.2 Real staging Supabase + Vercel preview tests for existing beta and new users, English + other launch languages, mic permission, voice availability/fallback, sync failure and recovery.
- M8.3 Measure data integrity (IDs/counts/stats/checksums), AI quality, TTS listening quality, P50/P95 latency, token/TTS cost, retry rates, consent and privacy. Record explicit acceptance evidence and unresolved items.
- M8.4 Prepare reversible cutover and rollback: retain beta deployment, export old data before risky schema updates; test rollback build after any IndexedDB version bump. Never roll back by deleting data created after cutover.
- M8.5 Native handoff specification (shared domain/contracts, local repository + audio adapters, auth deep link/callback); native binaries explicitly **out of scope** of this web-app release.
PASS: all CP0–CP8 evidence attached, no critical/open data or prompt leakage bugs, real regression tests PASS, human approves release and production cutover.

## 4. File/change map (planned, no code changes in this planning step)
- \`src/types.ts\`, \`src/db/*\`, \`src/components/story_chat/db/storySessionDb.ts\`: versioned domain + migration/backup.
- New \`src/domain/language/*\`, \`src/domain/contracts/*\` or comparable modules: LanguagePack, AI model, normalization, pronunciation metadata.
- \`src/utils/aiService.ts\`, \`src/components/story_chat/StoryChatView.tsx\`: canonical AI adapter; atomic local writes; locale-aware flow.
- \`src/utils/tts.ts\`, new \`src/services/audio/*\`, \`src/components/SettingsView.tsx\`, \`src/components/PracticeGameView.tsx\`: voice listing, preview, persistence, fallback, no speed UI.
- \`src/components/story_chat/components/VoiceInput.tsx\`, \`src/utils/speech.ts\`: correct language capture and honest scoring labels.
- \`src/services/supabase/*\`, \`src/services/storage/*\`, \`supabase/migrations/*\`: Auth, consent, sync queue, full snapshot and RLS.
- \`supabase/functions/generate-chunks/*\`: server-only prompt reference, validation, quota and provider boundary.
- \`docs/ai/*\`, \`docs/migration/*\`, \`docs/contracts/*\`, \`tests/*\`: implementation specification, fixture/evidence and acceptance commands.
- Private prompt assets **must NOT be committed** to the public repository. Any historical prompt remains disclosed.

## 5. Formal acceptance / evidence matrix
- DATA-01: open pristine \`main\` v4 DB without login; 100% fixture IDs and record counts retained.
- DATA-02: deep stats (stars, review timestamps/ratings/times) equal before/after migration.
- DATA-03: same-origin reload + new diary/chunk + existing practice run; all old relations valid.
- DATA-04: full export/import clean browser; per-store checksums and foreign key-like relations match.
- DATA-05: power/network interruption mid-sync + retry; latest local data preserved; no duplicate rows.
- DATA-06: higher IndexedDB version rollback tested with suitable backward-compatible build or explicit pre-upgrade recovery path.
- PRIV-01: prompt text absent from public current source, frontend bundle, network responses, client logs; historical exposure disclosed.
- PRIV-02: raw diaries not uploaded to cloud/corpus without distinct explicit consent.
- SEC-01: staging RLS cross-user SELECT/INSERT/UPDATE/DELETE denied; authorized owner upsert succeeds.
- AI-01: one common + max one personalized per semantic unit; meaning preserved; hallucination rejection.
- AI-02: English, Mandarin, Japanese, Korean + one additional Latin target pass supported language test fixtures.
- AI-03: malformed/untrusted provider output rejected atomically; no prompt returned in errors.
- VOICE-01: only voice choice shown, supports preview, accent through voice identity; no speed/quality/pitch UI.
- VOICE-02: desktop + mobile available voices, failure fallback, offline device playback and quota cap tested.
- ACC-01: guest→linked identity and second-device restore without data loss; switch user does not expose previous account.
- REL-01: preview release E2E + reviewer validation of test scripts, rollback/bridge instructions, human cutover approval.

## 6. Critical path, workflow and checkpoints
Critical path: M0 → M1 → M2 → M3 → M4 → M8. M5 runs after M2 and may progress alongside M3/M4; M6 starts after M1 and M3; M7 follows M1/M5/M6. Every milestone has one checkpoint CP0–CP8 with real source/evidence hashes. Run focused tests per task; broader reviewer checkpoints at contract changes, DB changes, prompt boundary, security and release—not every trivial commit.
GSA Planner manages scoped jobs within this plan; Tester provides execution evidence; Reviewer independently inspects code/test validity. Do not equate an unexecuted checklist with PASS. CR is requested explicitly by Human when needed.

## 7. Release, privacy, budget and failure handling
- Do not deploy preview on every commit; local and staging tests first, reserve Vercel preview for realistic integration gates.
- Separate staging vs production Supabase project, keys, prompt store and analytics; audit env variables and token leakage.
- Cloud TTS is optional; implement hard cap and fallback rather than assuming free indefinitely. Native speech quality depends on installed OS voices; expose supported choices honestly.
- Structured operations logging only: request ID, contract/prompt version, error category, metrics and timing; never diary text, private prompt, credential, full provider error or raw audio without consent.
- No production switch, merge to \`main\`, RLS migration on production or public DNS change without explicit Human approval and verified rollback/restore evidence.

## 8. Pending decisions to resolve within M0 (not implementation blockers)
- Which launch languages are fully supported vs marked experimental, and human language reviewers/fixtures.
- Supabase staging project identity and authorization; cloud provider pricing/license confirmations.
- Cloud diary backup consent scope/retention policy and TTS audio-cache licensing.
- Where to host private versioned prompts (Edge secret store for simple deployment vs separately restricted private repository/store for version history).
- Real-user beta fixture availability with opt-in and sanitization; never copy identifiable diaries into public tests.

**Document scope**: actionable master roadmap. It does not authorize implementation, deployment or release by itself.
