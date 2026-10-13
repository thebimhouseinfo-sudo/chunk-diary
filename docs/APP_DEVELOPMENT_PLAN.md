# ChunkDiary — Detailed App Development Plan
Version: 1.5 | Date: 2026-10-13 | Project: GSA P-493D | Status: DEVELOPMENT FIRST / FINAL MERGE ONLY

## Goal — Web Beta identity, ownership and reliable cloud continuation (2026-10-13 revision)

**Product goal:** A first-time user starts without registration as a Supabase Anonymous Guest, can learn locally and keep an identity-owned cloud copy, and can upgrade the **same Supabase user** by linking Google or Apple. A registered user can sign in across browsers/devices for free. A Guest may transfer/recover their identity using the simplest secure supported mechanism, with no checkout, wallet, paid issuance, or native-app payment implementation in Web Beta. Never lose or conflate diaries, chunks, practice history or StoryChat when changing identity/device.

**Supersession authority:** This v1.5 roadmap supersedes ONLY the old M6/M7/M8 identity, provider, cloud-backup policy, guest recovery and release-test tasks identified in §6. Earlier milestones and accepted technical security work remain valid; an implementation/test previously passed must not be rewritten merely because the task wording changed. Historical `docs/IMPLEMENTATION_PLAN.md` and checkpoint records are evidence, not active instructions.

**Revised security/consent contract:** Creating an anonymous account is not permission to claim or upload unknown pre-existing local beta content. For newly created Web Beta content, present an explicit cloud-storage disclosure at onboarding and enable identity-owned auto backup only after the disclosure/consent gate defined by the product; if consent is declined or offline, learning remains local and resilient. Any import from a legacy origin or another owner is separately user-confirmed. AI processing and corpus-sharing consents remain independent, with corpus-sharing OFF by default. Do not promise recovery after loss of all sessions unless a recovery credential/linked identity has already been established.

**Recovery mechanism selection (avoid token overengineering):** First evaluate lightweight device pairing using an approved, still-active Guest session (QR/short one-time handoff code plus confirmation on the source device). Support the lost-device case only with a pre-created recoverable credential **if** a safe, supported Supabase session/identity recovery protocol is proven in a staging spike. A random UUID, client-carried service key, arbitrary JWT or leaked refresh token is not an acceptable login method. A one-time server-mediated recovery secret is an implementation option, **not a mandatory product architecture**. Select the smallest reviewed and end-to-end-tested approach; do not create full token-commerce infrastructure. Future native storefront/paid entitlement gates are deferred; keep only a small backend issuance-policy seam if necessary.

**Platform / release boundary:** `codex/supabase-app` only until all gates pass and Human explicitly authorizes release. GitHub Pages beta (iframe on Blogger) and Vercel are different storage origins: they cannot auto-share IndexedDB. Real old-beta JSON export → new-preview JSON import has been verified by Human (1 diary, 5 chunks). Do not keep cross-origin automatic IndexedDB discovery as a release gate. Real production cutover/legacy-user onboarding must have a separately approved data-continuity pathway at M8; no edits to `main` or GitHub Pages without a new narrow explicit approval.

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

### M6 — Guest identity, owned cloud continuity, Google/Apple and recovery feasibility (depends M1, M3; CP6) — REVISED

**Phase goal:** Users start as secure Supabase Anonymous Guests, can persist their **own newly consented** learning data to the cloud, can upgrade the same identity via Google/Apple, and have a feasible low-complexity route for Guest device transfer. Preserve accepted CAS/RLS/queue/owner-isolation work; never weaken security in order to auto-sync.

**Superseded:** Previous M6.1 optional anonymous + Google/email → required first-run anonymous + Google/Apple; previous M6.2 manual-only backup → consented automatic identity-owned backup plus manual export/import fallback; previous M6.5 token-expiry-only tests → full guest linking/pairing/lost-device decision tree. DO NOT reactivate historical automatic claiming of unowned beta content.

Tasks:
- **M6-N1 Existing behavior audit (no rewrite):** Inventory and classify present Auth hooks, local vs account workspace routing, sign-out/guest switching, Supabase migrations, `manualBackup`, CAS, RLS and retry queue. Preserve validated owner checks and rollback. Explicitly mark removed/manual-only assumptions; remove obsolete task requirements without erasing evidence.
- **M6-N2 Auto Anonymous Guest:** On first run, create/resume Supabase Anonymous Auth only where consent/runtime permits, bind a distinct local identity-owned workspace, retain guest across refresh, handle offline / expired session safely, and never silently adopt beta-v4 data or another Guest's records. Enforce exact guest ID binding before cloud operations.
- **M6-N3 Consented automatic cloud continuity:** Explain cloud backup plainly on first run; after accepted consent, synchronize diaries, meaning units, chunks including stars/practice stats, semantic groups, settings, user progress, English chunks and StoryChat via already versioned snapshot/queue contracts. Restore is checksum/count/owner verified; protect local newer data and pending edits. Distinguish durable cloud sync from transient AI processing and separately opted-in corpus sharing. Queue on offline, retry without duplicate writes, show meaningful status. Anonymous `authenticated` JWT has `is_anonymous`; update verified RLS grants specifically for Guest-owned backup without cross-owner access. Never publish service-role secrets or bypass RLS in browser.
- **M6-N4 Upgrade to Registered Free:** Enable and test Google and Apple provider flows, including web redirects and later native compatibility contracts. Link existing Guest identity with Supabase `linkIdentity()` (manual-linking setting and callback guard), assert User ID/data ownership retained. A previously linked or conflicting provider account MUST NOT silently reassign/merge another account's data; provide safe stop and resolution.
- **M6-N5 Minimal Guest transfer decision spike:** Test (a) authenticated current-device approval + one-time QR/short pairing code to add a second device; (b) lost-source-device fallback with a recovery credential created beforehand. Determine whether an approved server-mediated exchange can provision an appropriate Supabase Auth session to a second device without distributing refresh tokens/service-role credentials or inventing identity. Prefer the simplest secure flow that works with actual Supabase primitives. Record feasibility, security threat model, costs and support limits. If lost-device recovery cannot be safely supported in Web Beta, flag as a **Human product decision**, never claim a fake token method works. No admin issuance requirement, Credit wallet, checkout, native storefront or payment verification.
- **M6-N6 Security and end-to-end verification:** Cross-Guest and Account A/B RLS, identical record IDs, anon/permanent JWT policies, multi-tab switching, interrupted linking, offline queue, stale writes, replay/expired/reused handoff codes, source-device approval, lost device, concurrent redemption, session revocation, rollback, staging-provider callback and two-browser restore. Keep backups usable offline and no silent loss.

**CP6 PASS:** Verified Guest auto creation/resume and consented owned backup, real restore on two browsers, correct Google/Apple upgrade with stable identity, and a demonstrated approved transfer/recovery path or explicit Human disposition of its documented limitation; red/green security tests and staging RLS checks pass. Provider tests that require Human devices are PASS_RETEST_REQUIRED until evidence exists.

### M7 — Guest/Registered UX, transparency, recovery and readiness (depends M1, M5, M6; CP7) — REVISED

**Phase goal:** The UI makes Guest cloud status, free Google/Apple registration and secure device continuation understandable, without fake account ownership or unnecessary manual steps.

**Superseded:** M7.1 Google/email, manual-backup-only primary UX, mandatory explicit account conversion for ordinary newly created Guest content; M7.4 production-inapplicable same-origin beta cutover as Web release PASS criterion. Manual JSON backup/import remains available as a verified fallback, not the normal Guest sign-in workflow.

Tasks:
- **M7-N1 Account states:** Guest Local/Pending/Synced/Failed/Offline versus Registered, current identity and last verified cloud snapshot, opt-in settings and safe retry; default new-user journey does not force registration or popups on every visit.
- **M7-N2 Upgrade flow:** Provide **Register free with Google / Apple**, review same-identity link outcome, preserve original Guest content and avoid silent switching to an existing different account. Hide email/password login. Browser callback errors and provider-unavailable fallback must be truthful.
- **M7-N3 Change device:** Show only the chosen M6-N5 mechanism. For source-device pairing, display QR/code, expiry and explicit approval. For pre-created recovery credential, explain secure storage and loss warning before issuance. Distinguish account **transfer** from data **merge**; if destination Guest has data, block overwrites and require an explicit safe choice. No pretend token login UI before backend capability is proven.
- **M7-N4 Privacy and backups:** Keep distinct AI_PROCESSING, BACKUP_SYNC and CORPUS_SHARE disclosure controls, export/import JSON integrity, backup status and cancellation; do not auto-associate prior beta-origin data. Keep voice and multilingual UI tasks already implemented unchanged.
- **M7-N5 UX negative controls:** No session/expired session, offline creation, source lost, duplicate redemption, Google/Apple conflict, account switch, missing backup, same-ID different owners, failed restore, delayed sync and new-user onboarding without incidental content upload.

**CP7 PASS:** UI claims match verified backend behaviors, manual JSON fixture remains functional, Guest cloud state and free Google/Apple registration are testable, device handoff has user-verified results where supported. Do not touch `main` or production.

### M8 — Integrated QA, launch data continuity, native handoff and release (depends M4, M6, M7; CP8) — REVISED

**Phase goal:** Verify one complete, secure Web app and its real data continuity, with no assumption that GitHub Pages iframe IndexedDB can be opened by Vercel.

**Superseded:** Previous M8.4 same-origin rehearsal as sufficient production migration gate and any M8 requirement that cross-origin beta content auto-appears without an actual transfer channel. Retain hermetic same-origin reader regressions as useful internal compatibility tests only, not proof of production cutover.

Tasks:
- **M8-N1:** Independent Reviewer assesses code/tests, red-green negative controls, provider linking and recovery security, cloud consent, owner boundaries, backup checksum and full-app browser/device QA; no unresolved critical cases.
- **M8-N2:** Real staging Supabase + Vercel checks on desktop, Android browser, iOS Safari where possible: Guest creation, learning offline, automatic consented sync, restore, Google/Apple OAuth linking, Guest device transfer/recovery, identity switch and RLS against cross-user access. Defer native OS mic/offline voice.
- **M8-N3:** Verify snapshot content IDs/counts/practice stats/StoryChat, privacy/network traces, failed operations, quota, model quality, browser speech/voice coverage, AI processing/backup/corpus consent separation and rollback.
- **M8-N4:** Explicitly decide and test real existing-user continuity for GitHub Pages-in-Blogger → Vercel (distinct origins). Human-verified JSON export/import is a working **fallback**, not an automatic bridge. Do not invent cross-origin IndexedDB sharing or require implementation of an iframe bridge without separate Human approval. Record an honest user-facing continuity path and acceptance criteria, then request Human sign-off before production replacement.
- **M8-N5:** Final full-app preview review, release candidate lock, explicit Human go/no-go, then only one approved replacement of `main`/production. Check backup restore and rollback, keep previous beta recovery deployment; native iOS/Android platform contracts only, no native binary, commerce or payment work.

**CP8 PASS:** End-to-end Guest/Registered cloud and device continuation verified, existing users have an explicitly approved and tested migration/continuity story, privacy/security gates and release rollback verified, independent Reviewer PASS and separate Human production approval.


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

## Development implementation checkpoint — 2026-10-10 (not release approval)

- **M0/M1 development foundation:** read-only beta v4 backup, structural tests, isolated import primitives, local-only backup download and file integrity preview implemented; **active account-aware restore/guest adoption and full app data routing NOT completed**. Production migration remains M8 only.
- **M2 contract/code:** BCP-47 language profiles, locale-aware segmentation, multilingual v2 parser with legacy v1 compatibility, true optional English pivot, and correct non-English chunk classification implemented. See `docs/contracts/MULTILINGUAL_V2.md`. Synthetic tests and TypeScript/build CI passed; real provider responses still depend on M3/M4 external configuration.
- **M3 private gateway code:** hardcoded prompt routes removed from current `server.ts` and Edge source; new Edge uses server-only `CHUNKDIARY_PROMPT_V2`, Auth verification, strict v2 response checks and a mandatory, durable quota RPC before any paid call. Edge is **disabled by default**. Deno negative controls and build passed. No provider key, prompt secret, quota database migration or live project deployment is complete. See `docs/contracts/PRIVATE_AI_GATEWAY.md`.
- **M5 Web voice:** browser voice-only chooser/preview and target-language filter, with no rate/pitch/quality selectors and no offline/native requirement, implemented. Browser SpeechRecognition uses native profile language and no fabricated transcript. TypeScript/build and browser-voice unit CI passed. Real iOS/Android listening tests remain.
- **Blocking user-owned external setup:** identify/create the dedicated **ChunkDiary** Supabase project; separately store `GEMINI_API_KEY`, `CHUNKDIARY_PROMPT_V2`, `CHUNKDIARY_PROMPT_VERSION` in that project's Edge secrets (never Git/chat); configure nonproduction publishable URL/key. Do not set `CHUNKDIARY_AI_ENABLED=true` until M4 quota/RLS staging migration, security tests and provider cost caps pass. A connected generic Supabase project is not assumed to belong to ChunkDiary.
- **Next coding milestones after project setup:** M4 authenticated/quota-controlled staging AI, M6 scoped Auth/cloud backup+RLS, M7 account/consent UX, M8 full E2E/security/release. No partial CI success authorizes early merge. `main` and production remain unchanged until the final Human-approved release.

## Development checkpoint — 2026-10-11 (M6 security and database recovery)

- **Dev source of truth** remains `codex/supabase-app`; `main` and the production Vercel beta remain unchanged. No beta data cutover.
- **Dedicated Supabase project** `nwowifnlfgcmmoiglgmu` is verified; 7/7 database migration versions and names are now tracked in `supabase/migrations/`. The first six are restored from their actual Supabase migration-ledger SQL, not approximated. The 7th reproduces the user-applied security refactor; it was applied idempotently via the staging migration tool and recorded as version `20261010191845`.
- **M4 AI:** Edge gateway is deployed with server-side prompt and provider secret; synthetic v2 Japanese generation passed using `gemini-3-flash-preview`. AI quota remains `enabled=false`. Private prompt/API key are not in Git; live model quality still needs broader evidence.
- **M6 Auth/storage:** local beta remains separate from account-owned IndexedDB; linked owner must be freshly verified on app boot. Failed account verification shows a suspended-account choice, never automatically reveals unclaimed beta. Two-account identical-ID, StoryChat, settings, restore and beta-preservation tests passed.
- **M6 consented cloud:** manual whole-workspace snapshot and empty-only restore; CAS checksum enforced by SQL, with a persistent owner-bound retry queue (pending/failed/synced), anti-duplicate lease, explicit retry/backoff, switch protection and checksum readback after an uncertain response. No automatic upload on login, edit or AI generation; corpus share defaults OFF.
- **Database security:** Supabase Advisor **0 WARN/ERROR** after moving the privileged snapshot operation into `chunkdiary_private` and changing the public RPC to `SECURITY INVOKER`. The two remaining private quota-table INFO notices are intentional. RLS denies cross-account data reads/updates and anonymous cloud backups. SQL rollback CAS tests PASS and leave zero synthetic users/rows.
- **Still not accepted:** real linked Google/email identity and callback UX testing; second real browser/device reconciliation with divergent data; M6 offline browser E2E; independent Reviewer signoff; M7 polished account/privacy UX; M8 full-app regression and user-approved direct cutover. Native app audio remains a later phase.

## 6. Supersession ledger — 2026-10-13 (controlling for identity and release tasks)

| Former requirement/task | Superseding task or disposition |
|---|---|
| M6.1 anonymous optional, Google/email | M6-N2 + M6-N4: auto Guest, Google/Apple; email/password OUT |
| M6.2 manual-only owned backup | M6-N3: disclosed/consented automatic owned sync; manual export/import retained |
| M6.3–M6.4 queue/CAS/RLS safeguards | RETAIN existing tested primitives; extend owner guard/RLS for Anonymous without weakening isolation |
| M6.5 testing account/expired tokens | M6-N5/N6 real device pairing/recovery feasibility and replay/owner tests |
| M7.1 Google/email and manual-only backup UI | M7-N1–N4 Guest/Registered, Google/Apple, truthful auto-sync and recovery UI |
| M7.4 / M8.4 same-origin cutover as real production test | M8-N4 cross-origin release continuity decision; retain same-origin test as internal only |
| Historical `IMPLEMENTATION_PLAN.md` ghost auto-claim and legacy beta interim branch | SUPERSEDED; no unconsented import/claim and no branch/main migration |
| Credit, storefront, guest token purchase, native payment | DEFER future native app, not Web Beta |

**Ordering:** Complete M6-N1 audit → M6-N2/N3 cloud Guest foundation → M6-N4 Google/Apple → M6-N5 small feasibility spike and Human decision if needed → M6-N6 negative tests → M7 UX → M8 full QA. Running independent existing M2–M5 retests is allowed. Reuse completed code and tests instead of rebuilding.

**Human action checkpoints:** Configure Google/Apple provider credentials and redirect URLs; approve any consent wording that changes user data processing; test real OAuth/device behavior; approve any production cutover. Routine staging checks and repo-only plan review do not authorize production changes.
