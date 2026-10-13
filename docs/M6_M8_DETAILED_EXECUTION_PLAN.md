# ChunkDiary — M6–M8 Detailed Execution Plan
Version: 1.0 | 2026-10-13 | Branch: `codex/supabase-app` | Status: PLANNED / NO IMPLEMENTATION AUTHORIZED
Authority: `docs/APP_DEVELOPMENT_PLAN.md` v1.5. This file details its M6–M8 work, not a separate release or change to M0–M5.

## GOAL
Deliver one secure, local-first ChunkDiary Web Beta in which new users become Supabase Anonymous Guests without mandatory registration, consented learning data can sync to their own cloud workspace, linking Google/Apple preserves identity, Guest Recovery restores learning on another device, and only one device holds the **online cloud learning/write lease** at a time. Users **must** be able to practice cached chunks and record local progress offline; generating new chunks requires the online AI API. Never lose, silently merge, or automatically claim another owner's data. Native wrappers, payments, checkout, QR, and changes to `main`/production are OUT until separately authorized.

### Fixed user-facing contracts (immutable during review)
1. Local: cached chunks and practice progress work offline; AI generation requires online API. Cloud writes wait for consent, connectivity and active lease. Revoked devices retain local records; conflict resolution is non-destructive, never silent.
2. Guest: create/resume real anonymous Supabase Auth identity; token recovery **A** preserve same User ID if secure and simple; otherwise **B** authenticate a real independent Guest, copy one validated cloud snapshot, no merge, no deletion of Guest A; A loses cloud learning/sync rights after successful B recovery. Same simple UX in either case.
3. Registered: link Google/Apple to existing Guest ID; free cross-device login. Many devices may authenticate, but only one holds an active online learning/cloud-write lease. Explicit takeover, no silent content merge.
4. Existing GitHub Pages/Blogger browser-origin data cannot be read by Vercel origin automatically. Human-tested old JSON export → Preview import is the known fallback. Never modify `main`/live beta during this development stage.
5. Preserve accepted CAS/owner isolation, queue, data schema, AI privacy, and other M0–M5 work. Reuse before rewriting. All implementation evidence is new and must be proven, not assumed from this plan.

## M6 — Identity, sync, secure session, Guest Recovery (CP6)
### GOAL
Guest starts without registering, consents to owned cloud backup, can link Google/Apple without a new user identity, and can recover on another device. Local offline practice works; server permits cloud writes/generation only for the active lease. Do not compromise owner/RLS protection.

### M6-A — Baseline audit (maps M6-N1; no speculative refactor)
- Inspect `src/services/supabase/client.ts` (anonymous sign-in/linkIdentity), `manualBackup.ts` (linked-only guard), `src/db/workspaceRouter.ts`, scoped DB/JSON import and queue, staging migrations, RLS policies, AI Edge functions and all direct browser Supabase writes.
- Produce a compact matrix: existing function → reused/changed → Guest/Registered behavior → owner/consent/lease checks → required test; preserve past successful evidence. Audit account switch, refreshed JWT, browser origin, local scope, queued writes, StoryChat.
- Gate: baseline tests and staging migrations identified; scope/owner transitions are explicit; no need to rewrite already-passed mechanics.

### M6-B — Guest foundation & consented sync (maps M6-N2/N3)
- Create/resume anonymous Supabase Auth on permitted online startup. Offline first-run still has safe local practice/data; never silently adopt another identity's records. Make guest workspace owner-bound and persistent across reload.
- Separate consent for cloud BACKUP_SYNC, AI_PROCESSING, optional CORPUS_SHARE (default OFF); no automatic upload of existing unclaimed beta records. Newly consented content syncs identity-scoped full snapshots via existing CAS/retry queue.
- Explicitly adjust server policies so authorized anonymous users can read/write only their own backup after verified consent and lease. Do not expose service-role credentials; do not weaken linked-user RLS.
- Negative tests: cross-Guest reads/writes, identical logical IDs in two accounts, unauthenticated clients, old JWT, revoked device, no consent, canceled backup, offline retries, checksum mismatch, conflicting newer data, StoryChat/stats restoration.
- Gate: two-browser Guest backup and restore with complete IDs/counts/stats, no silent upload and no lost queued work.

### M6-C — Single online learning lease (maps M6-N6; prerequisite to Guest transfer)
- One server-authoritative record per cloud user: device/session identifier, monotonic generation, expiry and server-time lease; acquire/revalidate/explicit takeover with atomic CAS. Different browser tabs belonging to same physical device must have a documented stable identity and safe refresh semantics.
- Server must validate lease + generation + ownership on **every** cloud mutation/RPC, auto-backup write and AI generation call; forbid any direct Supabase table path that bypasses lease enforcement. Check generation before starting costly AI and again before accepting/storing its result; cancellation/refund semantics for mid-flight takeover must be documented truthfully. Owner RLS remains required separately.
- Specify bounded heartbeat, expiry and renewal, sleeping tab, long network pause, token refresh, server outage, concurrent takeover and lost response. Lease expiry is not a guarantee that an offline browser is inactive locally.
- Offline allows practicing cached chunks and journaling progress in the correct local workspace. Reconnect without lease must NEVER silently upload or discard pending data; show conflict resolution/export and permit explicit takeover. Define testable policies for resolving progress of identical chunks versus genuinely conflicting learning histories, without merging user identities.
- Gate: tests with two devices/three tabs show only one active cloud writer, deterministic CAS winner, revoked stale JWT/session cannot call AI or persist snapshots, offline progress remains locally intact across reload and conflict.

### M6-D — Free provider link (maps M6-N4)
- Configure/test Google & Apple Supabase provider callbacks in staging. Link identities to the current Guest `auth.users.id`; prove owner scope, backup and queue survive refresh/login across devices.
- Detect provider already linked elsewhere and stop with a visible conflict; **no merge/claim/overwrite**. Remove email/password as the intended registration path; do not delete old implementation without proving references/compatibility.
- Gate: identical user ID and snapshot before/after successful link, rejected conflicting provider flow, browser redirect and sign-out recovery; real provider device tests remain RETEST_REQUIRED until observed.

### M6-E — Guest Recovery A/B feasibility decision (maps M6-N5)
- First verify available Supabase-supported mechanism for secure code → *real Auth session for existing anonymous User A*. UUID knowledge, forged JWT, refresh token in browser/code and service-role leakage are forbidden. Bound research to one documented staging prototype and security review; if session issuance is not demonstrably supported with reasonable complexity, choose B rather than expand infrastructure.
- Issue a free one-use high-entropy recovery code only from an authenticated Guest with active ownership; server stores hashed proof, expiry, attempt limits and logs only non-secret metadata. Code grants recovery authority, **never carries learning data**; user must save it before losing the original session. No QR.
- Preferred A: verify code, obtain supported actual User A session, transfer active lease to destination; old device loses online/cloud write authority but keeps local progress.
- Fallback B: create real authenticated empty Guest B and bind code to a server-side idempotency operation. Reserve token atomically → freeze/source-verify A snapshot → copy into B empty owner scope → verify checksum, IDs, relations, StoryChat and progress → atomically mark committed/consume token and revoke A's cloud learning/sync privilege. If a step fails before commit, A remains authorized and recoverable. Retrying the **same** operation must never duplicate B or content; concurrent redemption by another B fails. If response is lost after commit, status returns the same committed result. A account and stored snapshot remain; A and B do not merge/share later updates.
- Human decision only if both secure approaches fail; never claim recovery PASS because a credential-entry screen exists.
- Gate: live staging E2E and hostile tests for replay/guess/expiry, simultaneous claim, partial write, interrupted response, old device stale sync, destination already populated, user ID A stable or B independent.

### M6-F — CP6 integration and evidence
- Combine red/green unit tests, migration/RLS tests, browser A/B flows and safety trace; identify exact commit, database migration, preview deployment, test results and outstanding provider tests.
- CP6 PASS only if the implemented chosen recovery path works end-to-end, single cloud writer enforced server-side, offline local practice/progress retained, consented Guest backup/restore complete and Google/Apple link evidence sufficient. Formal Reviewer PASS is separate from editorial self-review.

## M7 — Account UX and device continuation (CP7)
### GOAL
Present one clear Guest/Registered account experience with transparent backup, simple Guest code recovery and safe device switching. Users can always practice existing local chunks offline; no account state misrepresentation.

### M7-A — Onboarding/account states (maps M7-N1)
- Guest local/pending/synced/failed/offline and Registered states, current owner, last confirmed snapshot, consent, retries. Avoid mandatory registration, repeated dialogs and implicit adoption of legacy content.
- Show offline cached-chunk practice as available; AI chunk creation needs connectivity. Distinguish cloud-disabled due to lost lease from loss of local records.

### M7-B — Google/Apple linking (maps M7-N2)
- Free provider buttons, callback outcomes, unchanged ID, provider conflict/cancel states; no email/password registration promise and no forced user merge.

### M7-C — Guest recovery and lease UX (maps M7-N3)
- Guest code issue/show once/save reminder, code redeem, expiry/reuse errors, success restoring content; underlying A/B method invisible as long as user-owned data is faithfully recovered. Never say B is technically the same auth identity.
- Explicitly ask before replacing an **online** active learning lease when necessary; secondary device may view/practice cached content and store local progress without lease but may not generate AI chunks or sync to cloud. Provide clear safe takeover, status of pending local progress, conflict disposition/export, not automatic merge/upload.

### M7-D — Privacy and negative paths (maps M7-N4/N5)
- Separate backup, AI and corpus disclosures; old beta JSON import remains explicit with checksum/ownership checks. Test offline practice, duplicate recovery, absent backup, provider conflict, destination nonempty, lease expiry/switch, pending queue, device removed, user log out.

### CP7 acceptance
- End-to-end UI matches backend truth; independently confirm offline practice survives refresh, data is not lost on recovery, code errors are intelligible, secondary browser cannot send AI/cloud mutations without lease, existing JSON export/import still works.

## M8 — Full-app QA and release boundary (CP8)
### GOAL
Demonstrate complete new Web app functionality with safe cloud/local continuity, security and rollback; do not mistake same-origin fixtures for actual legacy GitHub Pages → Vercel migration.

### M8-A — Comprehensive verification (maps M8-N1/N2/N3)
- Test on preview + staging Supabase desktop browsers, Android Chrome/iOS Safari where available: old-user JSON transfer, Guest identity, consent, cloud restore, offline cached practice/progress, online AI generation, provider link, A/B recovery, active lease transfer and attacks, queue conflict, StoryChat/stats, voice, internationalization, quotas, AI/privacy network traces.
- Include injected failures at snapshot commit, lease takeover, token reservation/redemption, uncertain network response, restart after commit and simultaneous stale mutations. Test no silent loss, no cross-owner leakage, no duplicate AI/billing.
- Independent reviewer/tester records all PASS/FAIL/RETEST_REQUIRED with exact commits/migration hashes/deployment IDs; no missing critical evidence may be called PASS.

### M8-B — Existing beta data continuity (maps M8-N4)
- GitHub Pages iframe origin and Vercel origin are distinct. Real tested export old JSON → import Preview is fallback; confirm full representative user coverage and explicit human-approved instructions. An automatic origin bridge needs separate human authorization. Never change the old beta just to satisfy a synthetic same-origin test.

### M8-C — Final release gate (maps M8-N5)
- Freeze tested release candidate, rollback/recovery strategy and complete product tests. Obtain independent Reviewer PASS and **separate explicit Human permission** before the sole final main replacement and production cutover. No early main merge, native app binary, voice-native implementation or payment/credit logic.

## Reviewer loop / anti-drift contract
- At EACH review: compare findings against this overall GOAL and M6/M7/M8 GOAL verbatim. A fix may refine mechanisms, not delete offline practice, force new identity, merge owners, turn on unsolicited uploads or authorize premature release.
- Required review evidence per finding: ID, severity, exact clause, observed contradiction/risk, bounded correction, test/acceptance mapping, outcome. Mark feasibility unknown rather than inventing a PASS.
- Traceability: M6-A→N1; M6-B→N2/N3; M6-C→N6; M6-D→N4; M6-E→N5; M6-F→CP6; M7-A..D→N1..N5; M8-A..C→N1..N5. No replaced legacy task silently reactivated.
- Reviewer gate: documentation consistency can PASS while implementation feasibility, provider-device tests, RLS and real lease/recovery still await execution. CR invocation is independent from Planner self-review.
