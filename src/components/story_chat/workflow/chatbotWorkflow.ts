import { chatbotMessages } from "./chatbotMessages";
import { UserSettings } from "../../../types";

export interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  createdAt: string;
}

export class ChatbotWorkflow {
  static getGreeting(settings: UserSettings | null, isFirstTime: boolean): string {
    return chatbotMessages.getGreeting(settings, isFirstTime);
  }

  static getEncouragement(): string {
    return chatbotMessages.getEncouragement();
  }

  static getTooLongWarning(): string {
    return chatbotMessages.getTooLongWarning();
  }

  static get30sReminder(): string {
    return chatbotMessages.get30sReminder();
  }

  static get60sReminder(): string {
    return chatbotMessages.get60sReminder();
  }

  static getRecommendation(): string {
    return chatbotMessages.getRecommendation();
  }

  static getEndingMessage(settings: UserSettings | null): string {
    return chatbotMessages.getEndingMessage(settings);
  }
}
