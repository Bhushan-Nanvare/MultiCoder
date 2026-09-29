import type { RoomMode, RoomVisibility, SupportedLanguage } from '@/constants/index.js';
import type { ProjectTemplateId } from '@/projects/templates/types.js';

export interface Room {
  id: string;
  name: string;
  language: SupportedLanguage;
  visibility: RoomVisibility;
  mode: RoomMode;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomInput {
  name?: string;
  language?: SupportedLanguage;
  templateId?: ProjectTemplateId;
  visibility?: RoomVisibility;
  mode?: RoomMode;
  ownerId?: string | null;
}

export interface UpdateRoomInput {
  visibility: RoomVisibility;
}

export interface RoomMemberView {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}
