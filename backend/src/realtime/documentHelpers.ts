import { z } from 'zod';
import {
  ENTRY_POINT_BY_LANGUAGE,
  MAX_FILE_BYTES,
  MAX_FILES_PER_ROOM,
  MAX_PROJECT_PATH_LENGTH,
  PROJECT_DOCUMENT_VERSION,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/constants/index.js';
import type { LegacyRoomDocument, ProjectDocument } from '@/realtime/types.js';
import { ValidationError } from '@/utils/errors.js';

export function languageToEntryPoint(language: SupportedLanguage): string {
  return ENTRY_POINT_BY_LANGUAGE[language];
}

export function createEmptyProjectDocument(language: SupportedLanguage): ProjectDocument {
  const entryPoint = languageToEntryPoint(language);
  return {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint,
    files: {
      [entryPoint]: { content: '', language },
    },
  };
}

export function isLegacyRoomDocument(raw: unknown): raw is LegacyRoomDocument {
  if (!raw || typeof raw !== 'object') return false;
  const doc = raw as Record<string, unknown>;
  return (
    doc.version !== PROJECT_DOCUMENT_VERSION &&
    typeof doc.content === 'string' &&
    typeof doc.language === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(doc.language)
  );
}

export function isProjectDocument(raw: unknown): raw is ProjectDocument {
  if (!raw || typeof raw !== 'object') return false;
  const doc = raw as Record<string, unknown>;
  return (
    doc.version === PROJECT_DOCUMENT_VERSION &&
    typeof doc.entryPoint === 'string' &&
    doc.files !== null &&
    typeof doc.files === 'object' &&
    !Array.isArray(doc.files)
  );
}

export function legacyToProject(legacy: LegacyRoomDocument): ProjectDocument {
  const entryPoint = languageToEntryPoint(legacy.language);
  return {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint,
    files: {
      [entryPoint]: { content: legacy.content, language: legacy.language },
    },
  };
}

export const projectFilePathSchema = z
  .string()
  .min(1)
  .max(MAX_PROJECT_PATH_LENGTH)
  .refine((path) => !path.startsWith('/') && !path.includes('..') && !path.includes('\\'), {
    message: 'Path must be relative with no parent segments',
  });

export function validateFilePath(path: string): void {
  try {
    projectFilePathSchema.parse(path);
  } catch (err) {
    throw new ValidationError('Invalid file path', err);
  }
}

export function validateProjectDocument(doc: ProjectDocument): void {
  validateFilePath(doc.entryPoint);
  if (!doc.files[doc.entryPoint]) {
    throw new ValidationError(`entryPoint "${doc.entryPoint}" is not present in files`);
  }

  const paths = Object.keys(doc.files);
  if (paths.length > MAX_FILES_PER_ROOM) {
    throw new ValidationError(`Project exceeds ${MAX_FILES_PER_ROOM} files`);
  }

  for (const [path, file] of Object.entries(doc.files)) {
    validateFilePath(path);
    if (typeof file.content !== 'string') {
      throw new ValidationError(`File "${path}" has invalid content`);
    }
    if (Buffer.byteLength(file.content, 'utf8') > MAX_FILE_BYTES) {
      throw new ValidationError(`File "${path}" exceeds ${MAX_FILE_BYTES} bytes`);
    }
  }
}

export function normalizeDocument(raw: unknown): ProjectDocument {
  if (isProjectDocument(raw)) {
    validateProjectDocument(raw);
    return raw;
  }
  if (isLegacyRoomDocument(raw)) {
    const migrated = legacyToProject(raw);
    validateProjectDocument(migrated);
    return migrated;
  }
  throw new ValidationError('Unrecognized room document shape');
}

export function projectEntryContent(doc: ProjectDocument): string {
  return doc.files[doc.entryPoint]?.content ?? '';
}

/** JSON0 ops that upgrade a legacy v1 document to ProjectDocument v2 in-place. */
export function buildLegacyMigrationOps(
  legacy: LegacyRoomDocument,
): Array<Record<string, unknown>> {
  const migrated = legacyToProject(legacy);
  return [
    { p: ['version'], oi: migrated.version },
    { p: ['entryPoint'], oi: migrated.entryPoint },
    { p: ['files'], oi: migrated.files },
    { p: ['content'], od: legacy.content },
    { p: ['language'], od: legacy.language },
  ];
}
