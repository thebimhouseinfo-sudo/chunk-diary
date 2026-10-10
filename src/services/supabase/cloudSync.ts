/**
 * Deprecated legacy cloud sync entry points. Kept for source compatibility
 * but fail CLOSED until the owner-scoped sync queue / separate consents are
 * implemented. No implicit anonymous Auth, uploads, restores or corpus share.
 *
 * The only enabled staging path is src/services/supabase/manualBackup.ts,
 * which requires linked Auth, explicit owner, explicit human click/confirmation,
 * owner-pinned RLS and validated checksums.
 */
import type { Chunk, UserSettings } from "../../types";

function disabled(): never {
  throw new Error("Legacy automatic cloud sync is disabled. Use explicit account backup/restore.");
}
export async function syncSettingsToCloud(_settings: UserSettings): Promise<boolean> {
  return disabled();
}
export async function syncProgressToCloud(): Promise<boolean> {
  return disabled();
}
export async function restoreProgressFromCloud(): Promise<number> {
  return disabled();
}
export async function syncGeneratedChunksToCorpus(_chunks: Chunk[]): Promise<boolean> {
  return disabled();
}
