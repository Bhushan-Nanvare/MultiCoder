import { MAX_FILE_BYTES, MAX_FILES_PER_ROOM, type SupportedLanguage } from '@/constants/index.js';
import { validateFilePath, validateProjectDocument } from '@/realtime/documentHelpers.js';
import type { ProjectDocument, ProjectFile } from '@/realtime/types.js';
import { ValidationError } from '@/utils/errors.js';

/**
 * Pure helpers for mutating a ProjectDocument. Stage 3 submits the resulting
 * ShareDB ops from the frontend; this service centralizes validation rules.
 */
export class ProjectFileService {
  listFiles(doc: ProjectDocument): string[] {
    validateProjectDocument(doc);
    return Object.keys(doc.files).sort();
  }

  addFile(
    doc: ProjectDocument,
    path: string,
    content = '',
    language?: SupportedLanguage,
  ): ProjectDocument {
    validateProjectDocument(doc);
    validateFilePath(path);

    if (doc.files[path]) {
      throw new ValidationError(`File already exists: ${path}`);
    }
    if (Object.keys(doc.files).length >= MAX_FILES_PER_ROOM) {
      throw new ValidationError(`Project cannot exceed ${MAX_FILES_PER_ROOM} files`);
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
      throw new ValidationError(`File content exceeds ${MAX_FILE_BYTES} bytes`);
    }

    return {
      ...doc,
      files: {
        ...doc.files,
        [path]: { content, ...(language ? { language } : {}) },
      },
    };
  }

  renameFile(doc: ProjectDocument, oldPath: string, newPath: string): ProjectDocument {
    validateProjectDocument(doc);
    validateFilePath(oldPath);
    validateFilePath(newPath);

    const existing = doc.files[oldPath];
    if (!existing) {
      throw new ValidationError(`File not found: ${oldPath}`);
    }
    if (doc.files[newPath]) {
      throw new ValidationError(`File already exists: ${newPath}`);
    }

    const moved: ProjectFile = existing;
    const rest = { ...doc.files };
    delete rest[oldPath];
    const files: Record<string, ProjectFile> = { ...rest, [newPath]: moved };

    return {
      ...doc,
      entryPoint: doc.entryPoint === oldPath ? newPath : doc.entryPoint,
      files,
    };
  }

  deleteFile(doc: ProjectDocument, path: string): ProjectDocument {
    validateProjectDocument(doc);
    validateFilePath(path);

    if (!doc.files[path]) {
      throw new ValidationError(`File not found: ${path}`);
    }

    const paths = Object.keys(doc.files);
    if (paths.length <= 1) {
      throw new ValidationError('Cannot delete the last file in a project');
    }

    const { [path]: _removed, ...rest } = doc.files;
    let entryPoint = doc.entryPoint;
    if (entryPoint === path) {
      const [nextEntry] = Object.keys(rest);
      if (!nextEntry) {
        throw new ValidationError('Cannot delete the last file in a project');
      }
      entryPoint = nextEntry;
    }

    return { ...doc, entryPoint, files: rest };
  }
}
