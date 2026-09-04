export type SupportedLanguage = 'javascript' | 'python' | 'cpp';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['javascript', 'python', 'cpp'];

/** Plan B v2 — multi-file project document (Stage 1+). */
export interface ProjectFile {
  content: string;
  language?: SupportedLanguage;
}

export interface ProjectDocument {
  version: 2;
  entryPoint: string;
  files: Record<string, ProjectFile>;
}

/**
 * Legacy single-file ShareDB document. Detected when `version` is absent and
 * root `content` is a string.
 */
export interface LegacyRoomDocument {
  content: string;
  language: SupportedLanguage;
}

export interface Room {
  id: string;
  name: string;
  language: SupportedLanguage;
  visibility: RoomVisibility;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  isOwner: boolean;
  isEditor?: boolean;
  canDelete?: boolean;
}

export const ROOM_VISIBILITIES = ['private', 'link-edit', 'link-view'] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

/**
 * @deprecated Replaced by ProjectDocument after Stage 1 migration.
 */
export interface RoomDocument {
  content: string;
  language: SupportedLanguage;
}

/** Default entry file path when a room is created, keyed by room language. */
export const ENTRY_POINT_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  javascript: 'main.js',
  python: 'main.py',
  cpp: 'main.cpp',
};

export const PROJECT_DOCUMENT_VERSION = 2 as const;

export const PROJECT_TEMPLATE_IDS = [
  'javascript-starter',
  'python-starter',
  'node-two-file',
  'cpp-starter',
] as const;

export type ProjectTemplateId = (typeof PROJECT_TEMPLATE_IDS)[number];

export interface ProjectTemplateSummary {
  id: ProjectTemplateId;
  name: string;
  description: string;
  language: SupportedLanguage;
  entryPoint: string;
  fileCount: number;
}
export interface RoomMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}
export const MAX_FILES_PER_ROOM = 50;
export const MAX_FILE_BYTES = 64 * 1024;
export const MAX_PROJECT_PATH_LENGTH = 256;
