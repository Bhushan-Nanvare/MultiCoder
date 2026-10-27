import {
  BINARY_FILE_EXTENSIONS,
  ENTRY_POINT_BY_LANGUAGE,
  GITHUB_IMPORT_MAX_TOTAL_BYTES,
  MAX_FILES_PER_ROOM,
  MAX_FILE_BYTES,
  PROJECT_DOCUMENT_VERSION,
  type SupportedLanguage,
} from '@/constants/index.js';
import type { GithubTreeEntry } from '@/github/githubClient.js';
import { projectFilePathSchema } from '@/realtime/documentHelpers.js';
import type { ProjectDocument } from '@/realtime/types.js';
import { ValidationError } from '@/utils/errors.js';

export interface ImportedFile {
  path: string;
  content: string;
}

const EXTENSION_BY_LANGUAGE: Record<SupportedLanguage, string[]> = {
  javascript: ['js', 'mjs', 'cjs'],
  python: ['py'],
  cpp: ['cpp', 'cc', 'cxx', 'hpp', 'h'],
};

const binaryExtensions = new Set<string>(BINARY_FILE_EXTENSIONS);

function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function selectImportableEntries(entries: GithubTreeEntry[]): GithubTreeEntry[] {
  return entries
    .filter((entry) => entry.type === 'blob')
    .filter((entry) => !binaryExtensions.has(extensionOf(entry.path)))
    .filter((entry) => (entry.size ?? 0) <= MAX_FILE_BYTES)
    .filter((entry) => projectFilePathSchema.safeParse(entry.path).success)
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, MAX_FILES_PER_ROOM);
}

export function isProbablyText(bytes: Buffer): boolean {
  return !bytes.includes(0);
}

export function chooseEntryPoint(paths: string[], language: SupportedLanguage): string {
  const preferred = ENTRY_POINT_BY_LANGUAGE[language];
  const atRoot = paths.find((path) => path === preferred);
  if (atRoot) return atRoot;

  const byName = paths.find((path) => path.endsWith(`/${preferred}`));
  if (byName) return byName;

  const extensions = EXTENSION_BY_LANGUAGE[language];
  const byExtension = paths.find((path) => extensions.includes(extensionOf(path)));
  return byExtension ?? paths[0] ?? '';
}

export function buildProjectFromFiles(
  files: ImportedFile[],
  language: SupportedLanguage,
): ProjectDocument {
  if (files.length === 0) {
    throw new ValidationError('That repository has no importable text files');
  }

  const totalBytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, 'utf8'), 0);
  if (totalBytes > GITHUB_IMPORT_MAX_TOTAL_BYTES) {
    throw new ValidationError(
      `That repository exceeds the ${GITHUB_IMPORT_MAX_TOTAL_BYTES} byte import limit`,
    );
  }

  const paths = files.map((file) => file.path).sort((a, b) => a.localeCompare(b));
  return {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint: chooseEntryPoint(paths, language),
    files: Object.fromEntries(files.map((file) => [file.path, { content: file.content }])),
  };
}
