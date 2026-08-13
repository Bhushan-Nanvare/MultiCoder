import type { SupportedLanguage } from '@/constants/index.js';

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
 * root `content` is a string. Migrated to ProjectDocument in Stage 1.2.
 */
export interface LegacyRoomDocument {
  content: string;
  language: SupportedLanguage;
}

/**
 * Shape of a ShareDB room document. The `content` field holds the raw source
 * code; ShareDB's json0 OT operates on it as a string for collaborative edits.
 *
 * @deprecated Replaced by ProjectDocument after Stage 1 migration.
 */
export interface RoomDocument {
  content: string;
  language: SupportedLanguage;
}
