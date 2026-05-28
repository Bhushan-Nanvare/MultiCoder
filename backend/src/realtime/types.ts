import type { SupportedLanguage } from '@/constants/index.js';

/**
 * Shape of a ShareDB room document. The `content` field holds the raw source
 * code; ShareDB's json0 OT operates on it as a string for collaborative edits.
 */
export interface RoomDocument {
  content: string;
  language: SupportedLanguage;
}
