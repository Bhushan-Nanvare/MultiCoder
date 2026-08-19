import type { SupportedLanguage } from '@/types/room';
import { MAX_PROJECT_PATH_LENGTH } from '@/types/room';

export type ProjectFileInsertOp = {
  p: ['files', string];
  oi: { content: string; language?: SupportedLanguage };
};

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
