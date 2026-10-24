import {
  CHAT_DOCUMENT_VERSION,
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_MAX_MESSAGES,
} from '@/constants/index.js';
import { ValidationError } from '@/utils/errors.js';

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

const DOCUMENT_KEYS = new Set(['version', 'messages']);
const MESSAGE_KEYS = new Set(['id', 'userId', 'username', 'text', 'at']);

export function createEmptyChatDocument(): ChatDocument {
  return { version: CHAT_DOCUMENT_VERSION, messages: [] };
}

export function isChatMessage(raw: unknown): raw is ChatMessage {
  if (!raw || typeof raw !== 'object') return false;
  const message = raw as Record<string, unknown>;
  return (
    Object.keys(message).every((key) => MESSAGE_KEYS.has(key)) &&
    typeof message.id === 'string' &&
    typeof message.userId === 'string' &&
    typeof message.username === 'string' &&
    typeof message.text === 'string' &&
    typeof message.at === 'string'
  );
}

export function assertValidChatDocument(raw: unknown): ChatDocument {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Chat document must be an object');
  }

  const doc = raw as Record<string, unknown>;
  for (const key of Object.keys(doc)) {
    if (!DOCUMENT_KEYS.has(key)) {
      throw new ValidationError(`Unexpected chat field "${key}"`);
    }
  }
  if (doc.version !== CHAT_DOCUMENT_VERSION) {
    throw new ValidationError('Unsupported chat document version');
  }
  if (!Array.isArray(doc.messages)) {
    throw new ValidationError('Chat messages must be an array');
  }
  if (doc.messages.length > CHAT_MAX_MESSAGES) {
    throw new ValidationError(`Chat exceeds ${CHAT_MAX_MESSAGES} messages`);
  }

  for (const message of doc.messages) {
    if (!isChatMessage(message)) {
      throw new ValidationError('Chat contains a malformed message');
    }
    const text = message.text.trim();
    if (text.length === 0) {
      throw new ValidationError('Chat messages cannot be empty');
    }
    if (message.text.length > CHAT_MAX_MESSAGE_LENGTH) {
      throw new ValidationError(`Chat messages cannot exceed ${CHAT_MAX_MESSAGE_LENGTH} characters`);
    }
  }

  return doc as unknown as ChatDocument;
}

export function insertedMessages(components: unknown): ChatMessage[] {
  if (!Array.isArray(components)) return [];
  return components
    .map((component) => (component as { li?: unknown } | null)?.li)
    .filter((inserted): inserted is ChatMessage => isChatMessage(inserted));
}
