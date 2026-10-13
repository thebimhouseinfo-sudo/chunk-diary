# ChunkDiary — M6-A live baseline audit (2026-10-13)
## GOAL
Inventory current Guest/Registered/Auth/Cloud/AI implementation against approved M6–M8 goals before modifying code. Reuse existing security and local-first behavior. No production, main, or staging policy changes in this audit.

## Evidence source
- Source branch: `codex/supabase-app`. Files retrieved live: `src/services/supabase/client.ts`, `src/services/supabase/manualBackup.ts`, `src/services/supabase/backupQueue.ts`, `src/db/workspaceRouter.ts`, `src/db/scopedWorkspace.ts`, `src/App.tsx`, `src/components/SettingsView.tsx`, `src/utils/aiService.ts`, `supabase/functions/generate-chunks/index.ts`.
- Supabase staging project: `nwowifnlfgcmmoiglgmu`, 7 migration versions listed (ending `20261010191845`). Live read-only SQL confirmed `public.sync_snapshots` owner policy and `chunkdiary_private.snapshot_cas_write_internal` currently **deny JWT is_anonymous=true**. No DDL or secrets changed.
- Prior synthetic tests and beta JSON export/import are *historical evidence*, not new E2E PASS or permission to enable cloud writes.

## Existing implementation → disposition → action/verification
| Surface | Observed baseline | M6 direction | Required evidence |
|---|---|---|---|
| `supabase/client.ts` | `ensureGuestSession` uses real `signInAnonymously`, persists/refreshes sessions; Google `linkIdentity` helper exists; obsolete email helper exists | REUSE Auth; wire safe first-use auto Guest only with correct local-owner isolation/consent; Apple provider later M6-D | Anonymous resume & refresh, offline bootstrap, Apple callback and Google same-UID link |
| `workspaceRouter.ts` | Scoped owner only chosen manually after verified **non-anonymous** Supabase user; default unscoped beta DB; unknown/expired linked identity suspends route | CHANGE in B1, not wholesale rewrite: owner-bound Guest by real UUID and persisted verification; protect legacy unclaimed local data, no implicit adoption | Guest A/B identical record ID isolation, sign-out/reload/offline/revoked session |
| `scopedWorkspace.ts` | UUID-namespaced account IDB, empty-only atomic import, validated snapshot/checksum; generic `guest` kind DB name unscoped | REUSE owner UUID scoped DB for Guest too; DO NOT use shared `guest` store for authenticated Guests | record counts/IDs/StoryChat, imported data ownership, local practice preserved |
| `App.tsx` | Calls routing verification, defaults local beta and preseeds if no account; does **not** first-run create Guest Auth workspace | CHANGE B1 startup sequence with legacy preservation and offline fallback; never silently assign beta data | Initial on/offline startup, refresh, persisted isolation, no seed over restored cloud |
| `manualBackup.ts` | Verified linked-user guard; CAS write, readback, empty-only restore, checksum and 5 MiB limit | REUSE serialization/CAS; Guest staging read/restore preparation B1, **no Guest cloud writes until B2 after active lease** | Cross-owner reject, checksum conflict, size limit, owner-auth mismatch |
| `backupQueue.ts` | Persistent IDB queue with local retry lock/backoff, **manual only** enqueue/send; duplicate uncertain response resolves by readback | REUSE CAS+retry; separate queue's 90s local mutex from **server active device lease**; do not auto-upload before B2/consent | Client refresh/interrupted request, wrong owner, stale lease generation, server revocation |
| `sync_snapshots` SQL RLS | `snapshot_owner` limits to `auth.uid()` AND `is_anonymous=false` on ALL | B1 **read-only design**; B2 allow verified Anonymous-owned access ONLY through server lease-guarded flow; never blanket grant to unverified devices | SQL role/owner negative controls; no anonymous write bypass |
| `snapshot_cas_write_internal` | SECURITY DEFINER CAS function rejects anonymous role claims; guards payload owner UUID/checksum/5MiB and locks by user | Keep CAS core, add server-authoritative lease checks in M6-C before B2; test privileged bypass | stale devices cannot call RPC; CAS conflict; no public direct-table bypass |
| `generate-chunks` Edge + `aiService.ts` | Frontend `ensureGuestSession()` before AI call; backend checks JWT and quota; currently no per-device active lease | M6-C check lease before claim/model request and before accepting result. New chunk generation remains online-only | competing devices, takeover in-flight, no stale billable call/commit |
| Settings/Account UX | Manual local JSON and cloud account settings, no unified Guest consented auto-cloud | M7 after M6 backend; clear BACKUP_SYNC vs AI_PROCESSING vs CORPUS_SHARE; no forced registration | new-user no hidden upload, Guest status, Google/Apple and recovery UX |

## Confirmed constraints
1. **No Guest cloud write yet**: both client linked-owner checks and Supabase staging RLS/CAS deny anonymous. Do not weaken them until the new server-side lease is enforceable and negatively tested.
2. Cloud backup local queue lock is NOT a global active-device lease; it prevents concurrent queue workers only on one device/browser.
3. Existing anonymous Auth session used for AI does NOT establish cloud workspace owner. UI and router currently remain in legacy local beta mode.
4. Offline practice must continue on cached chunks, with local progress retained even if cloud lease is unavailable; no API-based chunk creation without connectivity.
5. Keep `main`, beta users/origin and production unchanged. No silent IndexedDB transfer to Vercel, no automatic legacy claim.

## Dependency handoff
- **M6-A status: audit evidence written, no source tests or runtime assertions yet.**
- **Next M6-B1:** design/implement Guest owner routing and consent/local pending queue using existing UUID-scoped DB; preserve legacy local unclaimed mode. Guest cloud auto-write stays OFF.
- **Next M6-C:** server authoritative active learning lease guarding AI and all cloud writes.
- **Only then M6-B2:** enable consented Guest cloud backup with verified RLS/CAS and end-to-end tests.
- M6-D provider linking, M6-E recovery, M6-F integration after B2.

## Test inventory status
Source package commands: `npm run lint` (tsc --noEmit), `npm run build`, `npm run test:legacy`. No command has been executed by this audit; earlier checkpoint outcomes are not counted as current checks. New M6 client/server tests and real staging E2E are required before CP6 PASS.
