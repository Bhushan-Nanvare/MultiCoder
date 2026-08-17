import {
  ENTRY_POINT_BY_LANGUAGE,
  PROJECT_DOCUMENT_VERSION,
  SUPPORTED_LANGUAGES,
  type LegacyRoomDocument,
  type ProjectDocument,
  type SupportedLanguage,
} from '@/types/room';

export function languageToEntryPoint(language: SupportedLanguage): string {
  return ENTRY_POINT_BY_LANGUAGE[language];
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

/**
 * Normalizes v1 or v2 ShareDB data to ProjectDocument for editor binding.
 * Server-side migration persists v2; this handles any in-flight v1 snapshot.
 */
export function normalizeProjectDocument(raw: unknown): ProjectDocument {
  if (isProjectDocument(raw)) return raw;
  if (isLegacyRoomDocument(raw)) return legacyToProject(raw);
  throw new Error('Unrecognized room document shape');
}

export function fileContent(doc: ProjectDocument, filePath: string): string {
  return doc.files[filePath]?.content ?? '';
}
