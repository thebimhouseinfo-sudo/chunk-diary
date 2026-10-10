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
- Independent security review of existing `public.chunkdiary_snapshot_cas_write` elevated function. Supabase Advisor still reports 0029; proposed private-schema refactor is **not applied**. Its SQL lives under `docs/proposals`, not live migration history.
- Migration history in staging includes versions 20261010142026, 20261010142312 and 20261010142447 not yet reconstructed in Git. Do **not** use `supabase db push` until reconciled.
- M6, M7 and M8 remain OPEN. No direct replacement, release or main merge.
