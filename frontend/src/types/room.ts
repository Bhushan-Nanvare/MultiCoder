export type SupportedLanguage = 'javascript' | 'python' | 'cpp';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['javascript', 'python', 'cpp'];

export interface Room {
  id: string;
  name: string;
  language: SupportedLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface RoomDocument {
  content: string;
  language: SupportedLanguage;
}
