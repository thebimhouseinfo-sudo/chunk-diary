import { ChatMessage } from "../workflow/chatbotWorkflow";

export interface StorySession {
  id: string; // Enforce required id
  status: "unfinished" | "completed";
  messages: ChatMessage[];
  summary?: string; // Add optional summary field
  generationStatus?: "idle" | "pending" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface StorySettings {
  theme: "system" | "light" | "dark";
  defaultInputMode: "voice" | "typing";
}
