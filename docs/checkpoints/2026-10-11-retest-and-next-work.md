# ChunkDiary development checkpoint — 2026-10-11

Source branch: `codex/supabase-app`. This is a **development checkpoint**, not a final GSA Job closure, M8 approval, production deployment or main merge.

## Decision: PASS_RETEST_REQUIRED

Use `PASS_RETEST_REQUIRED` for a bounded feature whose automated source/CI tests have passed but which still needs real user/device/provider verification. This designation **does not certify the real-world behavior** and does **not** automatically close a GSA Job whose required reviewer/task/closure evidence is missing. Record both automation evidence and the outstanding real-world evidence; proceed with independent development work.

| Area | Automated or staging evidence | Retest still required | Tracking |
| --- | --- | --- | --- |
| M0/M1 legacy read-only backup, import primitives and local settings UI | Synthetic IndexedDB and Chromium regressions recorded in project checkpoints | Real existing-user browser beta-v4 data, same-origin adoption and complete restore after full app integration | PASS_RETEST_REQUIRED (feature checkpoint, not all historical GSA Jobs) |
| M2 multilingual contract | Domain validation/negative controls | Real model output quality across supported languages and existing-user content | PASS_RETEST_REQUIRED |
| M3/M4 authenticated AI Edge | Staging synthetic Japanese generation with Gemini 3 Flash; quota control disabled | Real provider quality/cost/quota, error/retry and authenticated UX | PASS_RETEST_REQUIRED; do not enable quota by default |
| M5 browser voice | Unit/build coverage for voice chooser, locale, speech recognition | Safari iOS and Android voice selection, mic permissions, fallback and listening tests | PASS_RETEST_REQUIRED |
| M6 linked-identity and cloud workspace | SQL RLS/CAS, two-account data isolation, staging schema reconciled 7/7 | Real Google/email callback, two real browsers/devices with divergent data, offline reconciliation, M6 browser E2E, independent Reviewer closure | PASS_RETEST_REQUIRED for already-passed subfeatures; M6 milestone remains OPEN |
| M7 account/privacy UX | Not independently complete | Must implement and CI/review before any real-device retest designation | TODO |
| M8 full integrated app release | Not started | Full-app E2E, beta-v4 preservation, security, Reviewer and explicit Human go/no-go | BLOCKED until M7 and all gates |

## Continue development now — M7

1. Finish explicit account identity and consent UX in the existing app, without any implicit beta data adoption or upload on login.
2. Distinguish `AI_PROCESSING`, `BACKUP_SYNC` and `CORPUS_SHARE` independently in UI, with corpus share OFF by default; make every control's actual effect accurate.
3. Provide clear owner verification pending/failed UI, explicit retry and cancel, guest isolation, logout/switch protection, plus truthful pending/failed/synced backup states.
4. Keep signed-out/guest beta workspace visible without silent owner assignment. Add clear preview and confirmation before guest data adoption, explicit conflict rejection and rollback-safe paths.
5. Add negative controls for account switching, absent network, two same-ID accounts, old snapshots, retries and cancellation. Run typecheck/build and scoped browser tests before Reviewer.
6. Only after M7 passes source tests start M8 full-app integration and real-device retests, then request Human approval for a one-time main replacement.

## Release protection

`main` remains untouched at `a5be5a8c11b34e36396564b5f88fd915d9670af7`. No migration into main, no intermediate beta patch, no production deploy, no mandatory interim beta notice, no automatic cloud upload, no native/offline voice scope. Do not translate PASS_RETEST_REQUIRED into unconditional PASS.


## Human-approved targeted beta export exception — 2026-10-11

The user explicitly approved adding a **read-only, manual JSON export** to existing beta `main` for real compatibility tests. This supersedes the previous unconditional no-main-change rule **only for this narrow export feature**; it does not authorize any premature migration, cloud sync, auth, account adoption, deletion, or rollout of the new application to main.

- Old beta Settings: `Tải xuống dữ liệu (Backup)` directly captures the seven IndexedDB v4 stores, optional StoryChatDB v1 sessions, and allowlisted local settings; emits `chunkdiary.beta-v4.snapshot` version 1 JSON, checksum SHA-256.
- Format implementation on `main` intentionally reuses exactly `legacyCompatibility.ts` and `legacySnapshot.ts` from the dev app, to avoid incompatible serializers.
- User workflow: export from old beta on its original browser/origin; keep original data; open separate new-app preview; import the JSON file through explicit file preview/import UI; verify counts, IDs, semantic relationships, story sessions and practice statistics; confirm no cross-owner data adoption or upload.
- Main export is **not** a migration. Release replacement remains M8-only with explicit Human approval.
- Main source commits: `e08dc815`, `d4c2be9b`, `339610a9`, `b6845525` (CI). The production Vercel deployment and actual browser operation require distinct verification; don't infer deployed from Git commit.
- Acceptance: old beta export button downloads checksum-valid JSON; new app parses and safely imports into a matching empty scoped workspace only with explicit confirmation; original beta remains unchanged. Track **PASS_RETEST_REQUIRED** until user performs real-data cross-app compatibility validation.

## Clarification — real-user export is test fixture ONLY (2026-10-11)

The Human clarified: Existing users download JSON from the CURRENT production beta and provide it privately to the developer solely as a real-data fixture for testing the NEW beta/preview app's import compatibility. **This is not the end-user migration procedure.** Do not require old users to download, upload, sign in, import, restore or consent to cloud transfer when the new app replaces the old app.

The actual final one-time same-origin cutover must automatically discover and load the existing `LanguageChunkDiaryDB` v4, `StoryChatDB` v1 and relevant localStorage learning settings on the user's existing browser/device, preserving IDs, relations, review statistics and sessions, without an import button or user intervention. New app must offer the same original data and progress immediately under Local/guest mode. Keep a non-destructive backward-compatible read path and prohibit automatic account adoption, cloud upload and database deletion.

**Two separate test gates:**
1. REAL-DATA OFFLINE FIXTURE: consented JSON from existing user -> isolated new-app preview import -> compare all counts/IDs/checksum/practice statistics/StoryChat with original; never publish private user data into GitHub or test artifacts.
2. AUTOMATIC SAME-ORIGIN UPGRADE: seed a real browser origin with a representative old beta v4 DB and StoryChatDB v1 plus learning localStorage, then serve new app on precisely the SAME origin. Without invoking import/export/login, verify immediate reading of old diaries/chunks/progress/settings/story sessions across reload and practice; verify no destructive schema upgrade, reownership, wipe or upload. M8 release gate requires this test independently of JSON import.

A passed JSON import is not evidence of passed automatic same-origin local loading. Failure of either gate blocks final replacement of production. Production beta export remains an optional testing/backup utility only.
