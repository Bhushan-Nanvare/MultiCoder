import type { SupportedLanguage } from '@/constants/index.js';

export interface Room {
  id: string;
  name: string;
  language: SupportedLanguage;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomInput {
  name?: string;
  language?: SupportedLanguage;
  ownerId?: string | null;
}
