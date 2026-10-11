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
