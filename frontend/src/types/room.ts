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
  createdAt: string;
  updatedAt: string;
}

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
export const MAX_FILES_PER_ROOM = 50;
export const MAX_FILE_BYTES = 64 * 1024;
export const MAX_PROJECT_PATH_LENGTH = 256;
