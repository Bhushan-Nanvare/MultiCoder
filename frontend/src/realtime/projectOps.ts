import type { ProjectFile, SupportedLanguage } from '@/types/room';
import { MAX_FILES_PER_ROOM, MAX_PROJECT_PATH_LENGTH } from '@/types/room';

export type ProjectFileInsertOp = {
  p: ['files', string];
  oi: ProjectFile;
};

export type ProjectFileDeleteOp = {
  p: ['files', string];
  od: ProjectFile;
};

export type ProjectStringReplaceOp =
  | { p: ['entryPoint']; od: string }
  | { p: ['entryPoint']; oi: string };

export type ProjectMutationOp = ProjectFileInsertOp | ProjectFileDeleteOp | ProjectStringReplaceOp;

export function isValidProjectPath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= MAX_PROJECT_PATH_LENGTH &&
    !path.startsWith('/') &&
    !path.includes('..') &&
    !path.includes('\\')
  );
}

export function buildAddFileOp(
  path: string,
  content = '',
  language?: SupportedLanguage,
): ProjectFileInsertOp {
  if (!isValidProjectPath(path)) {
    throw new Error('Invalid file path');
  }
  return {
    p: ['files', path],
    oi: { content, ...(language ? { language } : {}) },
  };
}

export function buildDeleteFileOp(path: string, file: ProjectFile): ProjectFileDeleteOp {
  if (!isValidProjectPath(path)) {
    throw new Error('Invalid file path');
  }
  return { p: ['files', path], od: file };
}

export function buildRenameFileOps(
  oldPath: string,
  newPath: string,
  file: ProjectFile,
  entryPoint: string,
): ProjectMutationOp[] {
  if (!isValidProjectPath(oldPath) || !isValidProjectPath(newPath)) {
    throw new Error('Invalid file path');
  }
  if (oldPath === newPath) {
    throw new Error('New path must differ from the current path');
  }

  const ops: ProjectMutationOp[] = [
    { p: ['files', newPath], oi: file },
    { p: ['files', oldPath], od: file },
  ];

  if (entryPoint === oldPath) {
    ops.push({ p: ['entryPoint'], od: oldPath }, { p: ['entryPoint'], oi: newPath });
  }

  return ops;
}

export function buildSetEntryPointOps(oldEntry: string, newEntry: string): ProjectStringReplaceOp[] {
  if (!isValidProjectPath(newEntry)) {
    throw new Error('Invalid entry point path');
  }
  if (oldEntry === newEntry) return [];
  return [
    { p: ['entryPoint'], od: oldEntry },
    { p: ['entryPoint'], oi: newEntry },
  ];
}

export function assertCanAddFile(existingCount: number): void {
  if (existingCount >= MAX_FILES_PER_ROOM) {
    throw new Error(`Project cannot exceed ${MAX_FILES_PER_ROOM} files`);
  }
}

export function assertCanDeleteFile(fileCount: number): void {
  if (fileCount <= 1) {
    throw new Error('Cannot delete the last file in a project');
  }
}

const SECONDARY_FILE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  javascript: 'utils.js',
  python: 'utils.py',
  cpp: 'utils.cpp',
};

const FALLBACK_SECONDARY = ['helper.js', 'helper.py', 'helper.cpp', 'lib.js', 'lib.py', 'lib.cpp'];

/** Picks a secondary file name that does not collide with existing paths. */
export function suggestSecondaryFilePath(
  language: SupportedLanguage,
  existingPaths: string[],
): string | null {
  const existing = new Set(existingPaths);
  const preferred = SECONDARY_FILE_BY_LANGUAGE[language];
  if (!existing.has(preferred)) return preferred;

  for (const candidate of FALLBACK_SECONDARY) {
    if (!existing.has(candidate)) return candidate;
  }

  for (let index = 1; index <= 99; index += 1) {
    const ext = language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'js';
    const candidate = `file${index}.${ext}`;
    if (!existing.has(candidate)) return candidate;
  }

  return null;
}

/** Depth-first friendly sort so `src/a.js` groups under `src`. */
export function sortProjectPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export function pathDepth(path: string): number {
  return path.split('/').length - 1;
}
