import { UserSettings, PurchasedPackage } from "../../types";
import { getUserRestorePackage, restoreUserTargetProgress } from "../../db/userProgressDb";

/**
 * Cloud Sync Adapter Abstraction.
 * Provides clean plug-and-play methods for future cloud sync (e.g. Supabase, Firebase, REST API)
 * without requiring any UI component code changes.
 */

export interface CloudSyncAdapter {
  syncUserProfile(profile: UserSettings): Promise<boolean>;
  syncUserProgress(): Promise<boolean>;
  downloadPurchasedPackage(packageId: string): Promise<PurchasedPackage | null>;
}

/**
 * Default Local/Mock Adapter implementation.
 * Prepares the payload for online sync when cloud backend is attached.
 */
export class DefaultCloudSyncAdapter implements CloudSyncAdapter {
  async syncUserProfile(profile: UserSettings): Promise<boolean> {
    console.log("[CloudSyncAdapter] User profile prepared for cloud sync:", profile.nickname);
    return true;
  }

  async syncUserProgress(): Promise<boolean> {
    const records = await getUserRestorePackage();
    console.log(`[CloudSyncAdapter] Prepared ${records.length} learning records for cloud sync.`);
    return true;
  }

  async downloadPurchasedPackage(packageId: string): Promise<PurchasedPackage | null> {
    console.log(`[CloudSyncAdapter] Package download requested for: ${packageId}`);
    return null;
  }
}

export const cloudSync = new DefaultCloudSyncAdapter();
