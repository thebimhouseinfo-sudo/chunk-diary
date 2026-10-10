# M0 — Beta v4 Data Compatibility Baseline

Status: **implemented read-only analyzer and synthetic regression fixture; browser migration NOT yet verified**.
Branch: `codex/supabase-app`. Current release policy: direct replacement only after full gates; `main` stays untouched.

## Existing data contracts (source of truth: main beta's `src/db/indexedDb.ts`)

| Database | Version | Object store | Key | Existing indexes |
|---|---|---|---|---|
| LanguageChunkDiaryDB | 4 | diaries | id | — |
| LanguageChunkDiaryDB | 4 | meaningUnits | id | diaryId |
| LanguageChunkDiaryDB | 4 | chunks | id | meaningUnitId, semanticGroupId |
| LanguageChunkDiaryDB | 4 | semanticGroups | id | — |
| LanguageChunkDiaryDB | 4 | settings | key | — |
| LanguageChunkDiaryDB | 4 | englishChunks | id | specialty, packageId |
| LanguageChunkDiaryDB | 4 | userProgress | id | userId |
| StoryChatDB | 1 | sessions | id (`active`) | — |

Relevant localStorage keys to handle separately:
`user_settings`, `story_chat_settings`, `story_chat_has_seen_first_greeting`.
Browser/device fingerprints and any auth credentials are **not** personal learning backup fields.

Existing `Chunk` learning statistics are: `stars`, `bestAccuracy`, `timesPracticed`, `lastPracticed`, `totalReviews`, `averageRating`, `lastRating`, and `lastReviewed`. Practice updates occur in `chunks`; the auxiliary `userProgress` store is not a complete learning history.

## M0 source and test coverage

- `src/db/legacyCompatibility.ts` is a **pure**, side-effect-free, **read-only** inspector for a manually provided in-memory snapshot. It does not read browser storage, assign identities, write any database, send network requests, or perform restore/migration.
- `tests/fixtures/beta-v4.fixture.json` contains only **synthetic** records, including English and Mandarin chunks, sample legacy extension fields, realistic practice stats and unfinished StoryChat state.
- `tests/legacy-compat.test.ts` checks count, stable IDs, progress totals, unknown fields, optional missing semantic groups (beta welcome seed), missing references and negative controls for lost progress/fields and duplicate IDs.
- Digest `fingerprintLegacySnapshot` is SHA-256 of canonical JSON: object keys are sorted; DB store array order is sorted by primary key; nested arrays (e.g. chat message order) are **not** reordered. It detects loss/changes but it is not a privacy-preserving anonymization hash and must not be logged/uploaded with raw user snapshots.
- A dangling `semanticGroupId` does not invalidate a user record. Legacy seed itself references `welcome-group-1` without necessarily creating a group. Warnings must **never** trigger automatic deletion or normalization.

## Run

```bash
npm ci
npm run lint
npm run test:legacy
```

When npm dependencies are unavailable locally, TypeScript source can also be checked with the project toolchain; do not treat static checks as equivalent to browser evidence.

**Negative control**: test suite intentionally edits `timesPracticed`, removes an unrecognized old field, creates duplicate IDs and breaks relationships; the former cases **must be detected**, not reported as equivalent preserved snapshots. Reviewer must inspect the tests themselves.

## Remaining evidence / blockers before M1

1. Read or synthesize beta v4 IndexedDB in a **real browser at the same origin**, then replace the build without deleting IndexedDB; verify per-store record counts, IDs, stats and StoryChat context survive app initialization, refresh, practice and logout.
2. Capture actual sanitized/consented old-data fixtures if available; current fixture only proves code-based synthetic shape, not real user data.
3. Account-local ownership must be designed/tested before linking/uploading anyone's guest records. Avoid auto-adopting legacy DB into whichever account is logged in.
4. Full export/restore, checksum manifest with version, cross-account isolation and durable queue are **M1/M6** work. No user snapshot is persisted or uploaded by M0.
5. A future IndexedDB version bump needs explicit rollback feasibility: older beta may throw `VersionError` if it opens a higher-version DB.
6. Tests cover the pure inspector and fixture. They **do not** constitute E2E proof, Supabase security tests, or a production migration PASS.

Current phase explicitly excludes offline-native voice and OS microphone permission handling; Web browser audio work occurs in M5.
