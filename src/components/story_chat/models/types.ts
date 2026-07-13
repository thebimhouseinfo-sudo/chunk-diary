import { ChatMessage } from "../workflow/chatbotWorkflow";

export interface StorySession {
  id: string; // Enforce required id
  status: "unfinished" | "completed";
  messages: ChatMessage[];
  summary?: string; // Add optional summary field
  createdAt: string;
  updatedAt: string;
}

export interface StorySettings {
  theme: "system" | "light" | "dark";
  defaultInputMode: "voice" | "typing";
}
