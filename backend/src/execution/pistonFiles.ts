import {
  EXECUTION_MAX_PROJECT_BYTES,
  MAX_FILE_BYTES,
  MAX_FILES_PER_ROOM,
  MAX_PROJECT_PATH_LENGTH,
} from '@/constants/index.js';
import type { ExecuteProjectFile, ExecuteProjectRequest } from '@/execution/types.js';
import type { PistonExecuteFile } from '@/execution/pistonClient.js';
import { AppError } from '@/utils/errors.js';

function isSafePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= MAX_PROJECT_PATH_LENGTH &&
    !path.startsWith('/') &&
    !path.includes('..') &&
    !path.includes('\\')
  );
}

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

/**
 * Maps project paths to Piston file names. Unique basenames stay as basenames
 * so `require('./utils.js')` / `from utils import` work. Colliding basenames
 * keep the relative path.
 */
export function toPistonFiles(request: ExecuteProjectRequest): PistonExecuteFile[] {
  const { entryPoint, files } = request;

  if (files.length === 0) {
    throw new AppError('At least one file is required', 400, 'VALIDATION_FAILED');
  }
  if (files.length > MAX_FILES_PER_ROOM) {
    throw new AppError(`Project exceeds ${MAX_FILES_PER_ROOM} files`, 413, 'EXECUTION_TOO_MANY_FILES');
  }

  const seen = new Set<string>();
  let totalBytes = 0;
  for (const file of files) {
    if (!isSafePath(file.path)) {
      throw new AppError(`Invalid file path: ${file.path}`, 400, 'VALIDATION_FAILED');
    }
    if (seen.has(file.path)) {
      throw new AppError(`Duplicate file path: ${file.path}`, 400, 'VALIDATION_FAILED');
    }
    seen.add(file.path);
    const size = Buffer.byteLength(file.content, 'utf8');
    if (size > MAX_FILE_BYTES) {
      throw new AppError(`File "${file.path}" exceeds ${MAX_FILE_BYTES} bytes`, 413, 'EXECUTION_CODE_TOO_LARGE');
    }
    totalBytes += size;
  }

  if (totalBytes > EXECUTION_MAX_PROJECT_BYTES) {
    throw new AppError(
      `Project exceeds ${EXECUTION_MAX_PROJECT_BYTES} bytes`,
      413,
      'EXECUTION_CODE_TOO_LARGE',
    );
  }

  if (!seen.has(entryPoint)) {
    throw new AppError(`entryPoint "${entryPoint}" is not in files`, 400, 'VALIDATION_FAILED');
  }

  const paths = files.map((file) => file.path);
  const nameCount = new Map<string, number>();
  for (const path of paths) {
    const name = basename(path);
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }

  const ordered: ExecuteProjectFile[] = [
    files.find((file) => file.path === entryPoint) as ExecuteProjectFile,
    ...files.filter((file) => file.path !== entryPoint),
  ];

  return ordered.map((file) => {
    const name = basename(file.path);
    const unique = (nameCount.get(name) ?? 0) === 1;
    return { name: unique ? name : file.path, content: file.content };
  });
}
