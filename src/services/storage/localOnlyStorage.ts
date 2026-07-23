import { Diary } from "../../types";
import { getDiaries, saveDiary, deleteDiary } from "../../db/indexedDb";

/**
 * Client-Side Only Storage Manager for Raw Personal Diaries.
 * Guarantees that raw user chat stories and voice transcripts stay 100% local on device.
 */

export async function getLocalDiaries(): Promise<Diary[]> {
  const diaries = await getDiaries();
  // Filter or mark as local-only
  return diaries.map(d => ({ ...d, isLocalOnly: true }));
}

export async function saveLocalDiary(diary: Diary): Promise<string> {
  const localDiary: Diary = {
    ...diary,
    isLocalOnly: true
  };
  return await saveDiary(localDiary);
}

export async function deleteLocalDiary(diaryId: string): Promise<void> {
  await deleteDiary(diaryId);
}

/**
 * Export raw local diaries into a JSON backup payload for manual transfer if desired by user.
 */
export async function exportLocalDiariesBackup(): Promise<string> {
  const list = await getLocalDiaries();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    type: "ChunkDiary_LocalDiaries_Backup",
    diaries: list
  }, null, 2);
}
