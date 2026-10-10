import { openStoryDB, getActiveSession, saveSession, clearActiveSession } from "../db/storySessionDb";
import { StorySession } from "../models/types";
import { workspaceLocalKey } from "../../../db/workspaceRouter";

export class StoryService {
  static async getActiveSession(): Promise<StorySession | null> {
    try {
      return await getActiveSession();
    } catch {
      // Fallback to localStorage
      const saved = localStorage.getItem(workspaceLocalKey("story_chat_session"));
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    }
  }

  static async saveSession(session: StorySession): Promise<void> {
    try {
      await saveSession(session);
    } catch {
      localStorage.setItem(workspaceLocalKey("story_chat_session"), JSON.stringify(session));
    }
  }

  static async clearActiveSession(): Promise<void> {
    try {
      await clearActiveSession();
    } catch {
      localStorage.removeItem(workspaceLocalKey("story_chat_session"));
    }
  }
}