export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  at: string;
}

export interface ChatDocument {
  version: 1;
  messages: ChatMessage[];
}

export const CHAT_COLLECTION = 'chat';
export const CHAT_MAX_MESSAGE_LENGTH = 2_000;
export const CHAT_MAX_MESSAGES = 200;
