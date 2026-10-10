import { Chunk, UserSettings, PurchasedPackage } from "../../types";

/**
 * Cloud data persistence is deliberately disabled until ChunkDiary has:
 * - explicit and separate BACKUP_SYNC / CORPUS_SHARE consent;
 * - verified account-scoped local storage and Supabase RLS;
 * - ownership-pinned retry queues that cannot cross account switches.
 *
 * The existing legacy unscoped stores must NEVER be uploaded with the
 * current anonymous Supabase session. Returning false is a fail-closed
 * compatibility boundary, not a claim of successful cloud sync.
 *
 * M6 must replace this temporary guard with a consent-aware adapter, test
 * the backend access controls and only then expose a manual Sync action.
 */
export interface CloudSyncAdapter {
  syncUserProfile(profile: UserSettings): Promise<boolean>;
  syncUserProgress(): Promise<boolean>;
  downloadPurchasedPackage(packageId: string): Promise<PurchasedPackage | null>;
  syncGeneratedChunks?(chunks: Chunk[]): Promise<boolean>;
}

export class DefaultCloudSyncAdapter implements CloudSyncAdapter {
  async syncUserProfile(_profile: UserSettings): Promise<boolean> {
    return false;
  }

  async syncUserProgress(): Promise<boolean> {
    return false;
  }

  async syncGeneratedChunks(_chunks: Chunk[]): Promise<boolean> {
    return false;
  }

  async downloadPurchasedPackage(_packageId: string): Promise<PurchasedPackage | null> {
    return null;
  }
}

export const cloudSync = new DefaultCloudSyncAdapter();
