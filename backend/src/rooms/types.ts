import type { SupportedLanguage } from '@/constants/index.js';
import type { ProjectTemplateId } from '@/projects/templates/types.js';

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
  templateId?: ProjectTemplateId;
  ownerId?: string | null;
}
