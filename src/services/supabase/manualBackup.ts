import type { SupabaseClient } from "@supabase/supabase-js";
import {
  captureAccountWorkspaceBackup, importIntoScopedWorkspace, previewScopedImport,
  type ImportPreview,
} from "../../db/scopedWorkspace";
import { validateLegacyBackup, type LegacyBackup } from "../../db/legacySnapshot";
import { activeWorkspaceOwner, workspaceLocalKey } from "../../db/workspaceRouter";

export const CLOUD_BACKUP_VERSION = 1;
export const CLOUD_BACKUP_BYTES_LIMIT = 5 * 1024 * 1024;
export const CLOUD_BACKUP_SETTINGS_KEYS = [
  "user_settings", "story_chat_settings", "story_chat_has_seen_first_greeting",
] as const;

export interface OwnerCloudBackup {
  format: "chunkdiary.account.cloud-backup";
  version: 1;
  ownerUserId: string;
  backup: LegacyBackup;
}
export interface BackupReceipt {
  ownerUserId: string;
  checksum: string;
  recordCount: number;
  capturedAt: string;
}

async function verifyLinkedOwner(client: SupabaseClient, ownerUserId: string): Promise<void> {
  const active = activeWorkspaceOwner();
  if (active?.kind !== "account" || active.userId !== ownerUserId) {
    throw new Error("An explicit matching account workspace is required");
  }
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous || data.user.id.toLowerCase() !== ownerUserId.toLowerCase()) {
    throw new Error("Linked account ownership verification failed");
  }
}
function receiptOf(ownerUserId: string, backup: LegacyBackup): BackupReceipt {
  return {
    ownerUserId, checksum: backup.checksum, capturedAt: backup.capturedAt,
    recordCount: Object.values(backup.counts).reduce((sum, count) => sum + count, backup.storySessionCount),
  };
}
function checkedEnvelope(input: unknown, ownerUserId: string): Promise<LegacyBackup> {
  if (!input || typeof input !== "object") throw new Error("Cloud backup envelope absent");
  const record = input as Partial<OwnerCloudBackup>;
  if (record.format !== "chunkdiary.account.cloud-backup" ||
      record.version !== CLOUD_BACKUP_VERSION || record.ownerUserId !== ownerUserId) {
    throw new Error("Cloud backup belongs to a different owner or has unknown version");
  }
  return validateLegacyBackup(record.backup);
}

export async function createManualWorkspaceBackup(ownerUserId: string): Promise<LegacyBackup> {
  const scopedKeys: Record<string, string> = {};
  for (const key of CLOUD_BACKUP_SETTINGS_KEYS) {
    const value = localStorage.getItem(workspaceLocalKey(key));
    if (value !== null) scopedKeys[key] = value;
  }
  return captureAccountWorkspaceBackup(ownerUserId, { currentSettings: scopedKeys });
}

/** User-initiated only: NEVER triggered by login, AI generation or profile save. */
export async function uploadManualCloudBackup(
  client: SupabaseClient, ownerUserId: string, backup: LegacyBackup,
  options: { confirmed: true; expectedRemoteChecksum?: string | null },
): Promise<BackupReceipt> {
  if (options?.confirmed !== true) throw new Error("Explicit backup consent required");
  await verifyLinkedOwner(client, ownerUserId);
  const valid = await validateLegacyBackup(backup);
  const result = receiptOf(ownerUserId, valid);
  if (result.recordCount === 0) throw new Error("Empty workspace cannot overwrite a cloud backup");
  const payload: OwnerCloudBackup = {
    format: "chunkdiary.account.cloud-backup",
    version: CLOUD_BACKUP_VERSION, ownerUserId, backup: valid,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (bytes > CLOUD_BACKUP_BYTES_LIMIT) {
    throw new Error("Backup exceeds 5 MiB. Use local JSON export until chunked sync is available.");
  }
  await verifyLinkedOwner(client, ownerUserId);
  // Database-enforced compare-and-swap; client cannot bypass via direct table
  // INSERT/UPDATE (permissions revoked). UUID comes from verified Auth only.
  // Null expectation means create ONLY IF ABSENT, never overwrite a newer
  // backup from another device. Existing backup needs an explicit preview and
  // an expected checksum confirmed by the user.
  const { data, error } = await client.rpc("chunkdiary_snapshot_cas_write", {
    p_payload: payload,
    p_expected_checksum: options.expectedRemoteChecksum ?? null,
  });
  if (error) throw new Error("Cloud backup CAS failed: " + error.code);
  if (!data || typeof data !== "object" || data.allowed !== true ||
      data.checksum !== valid.checksum) {
    throw new Error("Cloud backup conflict or rejected write: " +
      (data && typeof data === "object" && typeof data.reason === "string" ? data.reason : "UNKNOWN"));
  }
  await verifyLinkedOwner(client, ownerUserId);
  return result;
}

export async function inspectManualCloudBackup(
  client: SupabaseClient, ownerUserId: string,
): Promise<{ backup: LegacyBackup; preview: ImportPreview; receipt: BackupReceipt }> {
  await verifyLinkedOwner(client, ownerUserId);
  const { data, error } = await client.from("sync_snapshots")
    .select("payload").eq("user_id", ownerUserId).maybeSingle();
  if (error) throw new Error("Cloud backup read failed: " + error.code);
  if (!data?.payload) throw new Error("No cloud backup was found for this account");
  await verifyLinkedOwner(client, ownerUserId);
  const backup = await checkedEnvelope(data.payload, ownerUserId);
  const preview = await previewScopedImport(backup, { kind: "account", userId: ownerUserId });
  return { backup, preview, receipt: receiptOf(ownerUserId, backup) };
}

/**
 * Does NOT wipe or merge any active records. A locally nonempty workspace
 * refuses import; the user must resolve this conflict in a future workflow.
 */
export async function restoreManualCloudBackup(
  client: SupabaseClient, ownerUserId: string, backup: LegacyBackup,
  options: { confirmed: true },
): Promise<BackupReceipt> {
  if (options?.confirmed !== true) throw new Error("Explicit restore confirmation required");
  await verifyLinkedOwner(client, ownerUserId);
  await validateLegacyBackup(backup);
  const preview = await previewScopedImport(backup, { kind: "account", userId: ownerUserId });
  if (!preview.canImport) throw new Error("Account already has local records; restore would overwrite them");
  // Re-fetch and checksum the remote owner envelope BEFORE any local write.
  const remote = await inspectManualCloudBackup(client, ownerUserId);
  if (remote.backup.checksum !== backup.checksum) {
    throw new Error("Cloud backup has changed since preview");
  }
  await verifyLinkedOwner(client, ownerUserId);
  await importIntoScopedWorkspace(remote.backup, { kind: "account", userId: ownerUserId }, { confirmed: true });
  restoreAccountPreferences(ownerUserId, remote.backup);
  return receiptOf(ownerUserId, remote.backup);
}


/** Restore only three allowlisted, owner-scoped local UI preferences. */
export function restoreAccountPreferences(ownerUserId: string, backup: LegacyBackup): void {
  const active = activeWorkspaceOwner();
  if (active?.kind !== "account" || active.userId !== ownerUserId) {
    throw new Error("Cannot restore settings into another owner's browser scope");
  }
  for (const key of CLOUD_BACKUP_SETTINGS_KEYS) {
    const value = backup.snapshot.localSettings[key];
    if (typeof value === "string") {
      localStorage.setItem(workspaceLocalKey(key), value);
    }
  }
}
