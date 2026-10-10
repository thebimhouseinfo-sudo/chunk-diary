import { Chunk, UserSettings } from "../../types";
import { getAllUserTargetProgress, restoreUserTargetProgress } from "../../db/userProgressDb";
import { ensureGuestSession, supabase } from "./client";

export async function syncSettingsToCloud(settings: UserSettings): Promise<boolean> {
  if (!supabase) return false;
  const session = await ensureGuestSession();
  const userId = session?.user.id;
  if (!userId) return false;

  const { error } = await supabase.from("user_settings").upsert({
    user_id: userId,
    settings,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return true;
}

export async function syncProgressToCloud(): Promise<boolean> {
  if (!supabase) return false;
  const session = await ensureGuestSession();
  const userId = session?.user.id;
  if (!userId) return false;

  const records = await getAllUserTargetProgress();
  if (records.length === 0) return true;

  const rows = records.map((record) => ({
    id: record.id,
    user_id: userId,
    payload: { ...record, userId },
    updated_at: record.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase.from("user_progress").upsert(rows);
  if (error) throw error;
  return true;
}

export async function restoreProgressFromCloud(): Promise<number> {
  if (!supabase) return 0;
  const session = await ensureGuestSession();
  const userId = session?.user.id;
  if (!userId) return 0;

  const { data, error } = await supabase
    .from("user_progress")
    .select("payload")
    .eq("user_id", userId);

  if (error) throw error;
  const records = (data || []).map((row) => row.payload);
  await restoreUserTargetProgress(records as any[]);
  return records.length;
}

export async function syncGeneratedChunksToCorpus(chunks: Chunk[]): Promise<boolean> {
  if (!supabase) return false;
  const session = await ensureGuestSession();
  const userId = session?.user.id;
  if (!userId || chunks.length === 0) return false;

  const now = new Date().toISOString();
  const rows = chunks.map((chunk) => ({
    id: chunk.id || crypto.randomUUID(),
    user_id: userId,
    payload: { ...chunk, userId },
    created_at: now,
    updated_at: chunk.updatedAt || now,
  }));

  const { error } = await supabase.from("generated_chunk_corpus").upsert(rows);
  if (error) throw error;
  return true;
}
