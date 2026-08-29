import { PROJECT_DOCUMENT_VERSION, type SupportedLanguage } from '@/constants/index.js';
import { languageToEntryPoint, validateProjectDocument } from '@/realtime/documentHelpers.js';
import type { ProjectDocument } from '@/realtime/types.js';
import { ValidationError } from '@/utils/errors.js';

export interface SnapshotProjectPayload {
  version: 2;
  entryPoint: string;
  files: ProjectDocument['files'];
}

export interface ParsedSnapshot {
  snapshotVersion: 1 | 2;
  project: ProjectDocument;
}

export function serializeProjectSnapshot(doc: ProjectDocument): string {
  validateProjectDocument(doc);
  const payload: SnapshotProjectPayload = {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint: doc.entryPoint,
    files: doc.files,
  };
  return JSON.stringify(payload);
}

export function parseSnapshotContent(
  raw: string,
  roomLanguage: SupportedLanguage,
): ParsedSnapshot {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isSnapshotProjectPayload(parsed)) {
        const project: ProjectDocument = {
          version: PROJECT_DOCUMENT_VERSION,
          entryPoint: parsed.entryPoint,
          files: parsed.files,
        };
        validateProjectDocument(project);
        return { snapshotVersion: 2, project };
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      // Fall through to legacy string handling.
    }
  }

  const entryPoint = languageToEntryPoint(roomLanguage);
  const project: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint,
    files: {
      [entryPoint]: { content: raw, language: roomLanguage },
    },
  };
  validateProjectDocument(project);
  return { snapshotVersion: 1, project };
}

export function snapshotListMeta(parsed: ParsedSnapshot): {
  snapshotVersion: 1 | 2;
  fileCount: number;
  entryPoint: string;
} {
  return {
    snapshotVersion: parsed.snapshotVersion,
    fileCount: Object.keys(parsed.project.files).length,
    entryPoint: parsed.project.entryPoint,
  };
}

function isSnapshotProjectPayload(raw: unknown): raw is SnapshotProjectPayload {
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
