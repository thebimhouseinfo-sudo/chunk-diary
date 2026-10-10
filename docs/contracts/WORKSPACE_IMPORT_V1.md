# M1 — Isolated import of beta-v4 backups (storage layer)

Status: **code implemented and undergoing CI review**. This is an opt-in storage API only; the existing application still reads and writes `LanguageChunkDiaryDB` v4, not the new workspaces. **Do not enable automatic account adoption, switch user sessions or restore from UI yet.**

## Source and destination

- Source: validated `LegacyBackup` from `captureLegacyBackup`, with exactly seven beta stores, StoryChat sessions, allowlisted local app settings, original IDs/stats/unknown properties and SHA-256 checksum.
- Guest destination: `ChunkDiaryWorkspace-v1-guest`.
- Account destination: `ChunkDiaryWorkspace-v1-account-<uuid>`, only with explicit syntactically valid account UUID. No implicit use of current Supabase session, automatic account binding, guest ownership claim or network upload.
- Destination stores are the seven canonical beta stores plus `storySessions`, `localSettings` and `__importMetadata`; all live inside one new IndexedDB version 1 for an atomic write transaction.
- Original `LanguageChunkDiaryDB`, `StoryChatDB` and origin `localStorage` are never updated, cleared, version-bumped or assigned an owner by this API.
- Passwords, Supabase tokens and arbitrary origin localStorage keys are not imported; only the three allowlisted local app settings are retained inside the scoped DB.

## API and constraints

`previewScopedImport(backup, {kind:"guest" | "account", userId?}, indexedDB?)` validates checksum and counts, shows destination, import size, whether data already exists, and **never creates a database**.

`importIntoScopedWorkspace(backup, owner, {confirmed:true, indexedDB?})` requires explicit prior approval by the caller, validates the entire backup before opening destination, rejects nonempty target, then inserts all records and import metadata **in one IndexedDB readwrite transaction**. It does not merge, upsert, overwrite or silently re-map IDs. A failed transaction aborts, so no partial user records commit. Repeating an import into occupied scope is blocked and leaves existing progress untouched. The import caller must obtain actual human-facing consent; the API's `confirmed` flag alone is *not a user interface*.

`verifyScopedImport(owner, indexedDB?)` independently rereads that owner workspace in readonly mode and verifies all records/fields, story and local settings against the import checksum. This digest is an **import-time baseline**, not a general-purpose ongoing-edit checksum: subsequent legitimate learning updates would change it.

Identical record IDs in different account scopes coexist because their databases are distinct. These functions do **not** by themselves make the current React application account-aware. All app read/write entry points, StoryChat, caching and sync queues must route through verified account-scoped adapters before enabling account switching.

## Verification

Tests: `tests/scopedWorkspace.test.ts` checks no-creation preview, explicit confirmation, complete guest import, same-ID import into two different accounts, wrong owner, repeated import, invalid or tampered manifest/checksum, unsupported schema, no original data mutation and post-import checksum detection.

Real-browser test: `tests/browser/m1-browser.test.ts` with `m1-harness.html` runs against a local Vite origin in **headless Chromium**. It creates the beta-v4 schema with the actual browser IndexedDB API, loads *synthetic* fixtures, imports into separate A/B workspaces, reloads the page at the exact same localhost origin and verifies persistence and source DB version 4. The browser suite also checks out the **actual source branch `main`** into an isolated CI folder, starts its Vite app at a local origin, inserts synthetic user records through the real browser IndexedDB API, stops that server, starts the new development app on the **same hostname and port**, and verifies those exact records, stats, custom properties and local settings survive. This is a source-level direct replacement rehearsal, **not** verification against the exact production deployment bundle or real user data. Final production-origin/device E2E remains a release gate.

**Development CI policy (Human correction 2026-10-10):** `.github/workflows/m1-browser.yml` runs typecheck, build, IndexedDB emulator, and **only the new-app** Chromium fixture and Settings tests. It **does not checkout `main`, start the old beta app, migrate code/data, or run the final beta-main→new-app source replacement scenario on ordinary development pushes**. That existing extra Chromium scenario is retained as test-only code for the **final M8 release acceptance stage**, after all app features are finished. No Vercel preview/production deployment is triggered.

## Deferred follow-up

1. Build a scope-aware storage repository consumed by **all** React app views, StoryChat, settings and practice updates. Do not show Account B's data from legacy guest DB. Use a per-session authorization/identity boundary; pass scope from validated Auth once available.
2. Provide visible account/guest import preview + consent, safe cancellation, conflict resolution and post-restore UI refresh; no forced registration.
3. Implement user-scoped cloud snapshots, per-user row keys/RLS, offline sync queue with ownership pinning. Account switch must cancel requests queued by previous account.
4. Test actual beta deployed build versus new app in a real browser at the same origin, with consenting/sanitized samples and backout path; browser emulation and synthetic fixture are not sufficient by themselves.
5. Explicitly verify any browser that still uses old GitHub Pages origin must export/bridge voluntarily. A redirect does not transfer IndexedDB.
