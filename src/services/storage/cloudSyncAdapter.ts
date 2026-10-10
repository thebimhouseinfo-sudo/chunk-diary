import { Chunk, UserSettings, PurchasedPackage } from "../../types";
import { getUserRestorePackage } from "../../db/userProgressDb";
import { restoreProgressFromCloud, syncGeneratedChunksToCorpus, syncProgressToCloud, syncSettingsToCloud } from "../supabase/cloudSync";

/**
 * Cloud Sync Adapter Abstraction.
 * Provides clean plug-and-play methods for future cloud sync (e.g. Supabase, Firebase, REST API)
 * without requiring any UI component code changes.
 */

export interface CloudSyncAdapter {
  syncUserProfile(profile: UserSettings): Promise<boolean>;
  syncUserProgress(): Promise<boolean>;
  downloadPurchasedPackage(packageId: string): Promise<PurchasedPackage | null>;
  syncGeneratedChunks?(chunks: Chunk[]): Promise<boolean>;
}

/**
 * Default Local/Mock Adapter implementation.
 * Prepares the payload for online sync when cloud backend is attached.
 */
export class DefaultCloudSyncAdapter implements CloudSyncAdapter {
  async syncUserProfile(profile: UserSettings): Promise<boolean> {
    const synced = await syncSettingsToCloud(profile);
    if (!synced) console.log("[CloudSyncAdapter] Supabase is not configured; profile remains local.");
    return synced;
  }

  async syncUserProgress(): Promise<boolean> {
    const records = await getUserRestorePackage();
    if (records.length === 0) return true;
    const synced = await syncProgressToCloud();
    if (!synced) console.log(`[CloudSyncAdapter] Supabase is not configured; ${records.length} learning records remain local.`);
    return synced;
  }

  async syncGeneratedChunks(chunks: Chunk[]): Promise<boolean> {
    const synced = await syncGeneratedChunksToCorpus(chunks);
    if (!synced) console.log(`[CloudSyncAdapter] Supabase is not configured; ${chunks.length} generated chunks remain local.`);
    return synced;
  }

  async downloadPurchasedPackage(packageId: string): Promise<PurchasedPackage | null> {
    if (packageId === "user-progress") {
      await restoreProgressFromCloud();
    }
    return null;
  }
}

export const cloudSync = new DefaultCloudSyncAdapter();
