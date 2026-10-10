# M6 development: account workspaces and consented backup

Status: **development / not accepted for production** (2026-10-10).

## Owner boundaries

- Local beta database remains `LanguageChunkDiaryDB` v4 and StoryChatDB v1.
- A linked, server-verified UUID activates a dedicated account IndexedDB. Anonymous Auth remains transient for AI processing, not recoverable cloud backup.
- If an account UUID is remembered but Auth cannot verify it, app requires explicit choice before opening Local beta. No silent import or upload.
- All legacy store IDs and practice statistics remain intact; two owners may have identical record IDs without collision.

## Manual cloud snapshot

- Only the user's explicit action can enqueue a backup. Never enqueue on startup, login, profile save or AI generation.
- The queue is separately stored in owner-namespaced IndexedDB. States: Pending, Failed, Synced. No automatic network retries; only a user click sends again.
- A lease prevents simultaneous local-tab sends; exponential cooldown handles failures. Remote compare-and-swap requires the latest cloud checksum. A conflict never silently overwrites another device.
- After a lost response, a read-only owner-authenticated checksum check may acknowledge an already-saved identical snapshot without resending data.
- Logout/account switch forbids queue operations under another identity. A failed upload preserves the original snapshot locally.
- Restoring cloud is only allowed into an EMPTY verified owner workspace after checksum validation and explicit confirmation. Restoring nonempty data needs a separately reviewed merge conflict strategy.
- Generated corpus sharing remains OFF. Old implicit cloud sync APIs fail closed.

## Remaining gates

- Live linked Google/email Auth with real redirects and two-device recovery; consent and queued retry after switching/expired tokens; offline mobile Safari/Chrome QA.
- **Database security remediation applied and verified:** public snapshot API uses `SECURITY INVOKER`, private helper uses `SECURITY DEFINER`, anonymous cannot call it, RLS and CAS rollback test PASSED. Supabase Advisor reports **zero WARN/ERROR**; two private quota-table INFO notices are intentional.
- **Database migration history reconciled:** seven versioned SQL files in `supabase/migrations/` match all seven applied Supabase versions **byte-for-byte**, including operator-applied private CAS remediation recorded as migration version `20261010191845`. CI now checks version/name and security invariants; environment parity still requires independent clean-project replay at M8.
- M6, M7 and M8 remain OPEN. No direct replacement, release or main merge.
