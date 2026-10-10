# M1 — Read-only beta backup capture v1

Status: **M1 read-only snapshot/export core implemented; import/restore, consent UX, and real-browser production migration NOT completed.**

## Data path

`captureLegacyBackup()` opens `LanguageChunkDiaryDB` **without an explicit version** and uses exactly one `readonly` transaction to read all seven existing stores. No schema upgrade, object-store creation, write transaction, cloud transfer, destructive normalization, or automatic owner assignment is permitted. It closes DB connections after use.

If the legacy beta DB does not exist, `open()`'s `onupgradeneeded` event aborts the automatic creation transaction. The function **throws rather than creating a new beta DB**, ensuring new users don't get an unexpected legacy store. Unsupported version and missing required stores fail without mutation.

`StoryChatDB` v1 is optional. A never-used Story Chat has no DB; the same aborted-upgrade technique avoids creating it. If it exists, the exporter reads its `sessions` store in a separate readonly transaction.

The three allowlisted localStorage keys are `user_settings`, `story_chat_settings`, and `story_chat_has_seen_first_greeting`. Do not include browser fingerprints, provider API keys, Supabase tokens, or unrelated origin-scoped credentials.

`captureLegacyBackup({ indexedDB, localStorage, now? })` returns an in-memory `LegacyBackup` envelope with `format`, `formatVersion`, `capturedAt`, full `snapshot`, per-store `counts`, `storySessionCount`, and `checksum` (SHA-256 over canonical strict JSON data). The caller owns this personal data and must obtain **separate explicit consent** before network upload. The function does not download a file or persist a copy.

`validateLegacyBackup()` checks snapshot structural integrity, per-store counts, StoryChat count, and checksum before any future restore. It rejects record or unknown-field loss; it does not write into IndexedDB.

## Safety guarantees and limits

- Preserve full object records, old keys, links, original practice statistics, StoryChat and supported local app settings. No projection to just `userProgress`.
- Beta welcome content may reference a missing optional `semanticGroupId`; the existing warning does not drop or reject the record.
- An unsupported IndexedDB structured-clone value such as `Date`, `undefined`, or circular references is **rejected during digest**, not silently coerced to JSON. M1 restore work later must define a lossless encoding for real non-JSON data if found.
- One transaction makes the seven stores consistent relative to one another. IndexedDB has **no cross-database atomic transaction** between `LanguageChunkDiaryDB`, `StoryChatDB` and localStorage; the app must prevent concurrent edits or retry/check before using a capture for recovery.
- Per-user scoped imports, multiple-account isolation, the local guest data claim, cloud sync, RLS and real same-origin beta-to-new-build E2E remain separate M1/M6/M8 tasks.
- The browser may lack IndexedDB or have storage permissions blocked. Fail clearly without creating a DB or erasing data.

## Tests

Node v22 workflow with pinned `fake-indexeddb@6.2.5` exercises actual IndexedDB request/transaction behavior instead of only a mock of the export function. Run locally:

```sh
npm ci
npm install --no-save --package-lock=false fake-indexeddb@6.2.5
npm run lint
npm run test:legacy
```

The pinned test emulator is currently installed by the CI workflow rather than added to the app's production dependency set. Tests verify all seven stores and StoryChat, version/properties and checksum, absent database no-create, optional StoryChat no-create, rejected unsupported schemas, unchanged timestamps/review statistics/unknown fields, wrong manifest, and strict no-loss negative controls. These emulated tests do **not** substitute for a real device/browser test at the production origin.

GitHub Actions workflow: `.github/workflows/m0-legacy.yml`. No preview or production deployment is triggered by this workflow.

## Settings UI: local-only backup and safe restore-file inspection

- `SettingsView.tsx` now provides **Tải bản sao dữ liệu local**, which calls `captureLegacyBackup()` and `validateLegacyBackup()` then downloads JSON using a browser Blob. This needs no premium subscription, linked account, or Supabase request. The file contains private diary and learning history; users should store it securely.
- **Kiểm tra tệp khôi phục** accepts a local JSON file (maximum 100 MiB for browser memory safety), checks backup envelope, all store counts, StoryChat count and SHA-256, and shows counts plus digest. A tampered file is rejected. The feature does **not import into the active application database**, change account ownership, or issue network requests. It must not be represented as completed Restore.
- Until verified account-scoped storage and distinct consent flows exist, `cloudSyncAdapter.ts` **fails closed** on profile/progress/corpus upload and restore. Automatic guest sign-in/profile upload during onboarding, and automatic corpus/progress upload after Story Chat generation, have been removed from their caller paths. AI generation triggered by the user is separate from persistent cloud upload; provider retention and disclosures remain an M3 gate.
- The existing Settings destructive reset action remains a **separate legacy behavior** and must be redesigned with scoped-ownership protections before enabling multi-account mode.
- Real Chromium regression opens current Settings UI, downloads a JSON snapshot, imports the downloaded file into the **validation preview only**, detects a deliberately corrupted copy, and confirms no new workspace was created. No actual production users' data is used.
