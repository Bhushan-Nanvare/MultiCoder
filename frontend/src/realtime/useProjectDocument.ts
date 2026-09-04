import { useCallback, useEffect, useState } from 'react';
import type { Doc } from 'sharedb/lib/client';
import { normalizeProjectDocument } from '@/realtime/documentHelpers';
import {
  assertCanAddFile,
  assertCanDeleteFile,
  buildAddFileOp,
  buildDeleteFileOp,
  buildRenameFileOps,
  buildSetEntryPointOps,
  buildSetLastRunOps,
  type ProjectMutationOp,
} from '@/realtime/projectOps';
import { SHAREDB_COLLECTION, getShareDbConnection } from '@/realtime/sharedbConnection';
import type { LastRunResult, ProjectDocument, ProjectFile, SupportedLanguage } from '@/types/room';

interface ProjectDocumentState {
  status: 'connecting' | 'ready' | 'error';
  error: string | null;
  files: string[];
  entryPoint: string;
  filesMap: Record<string, ProjectFile>;
  lastRun: LastRunResult | null;
  meta: Record<string, unknown> | undefined;
}

const initialState: ProjectDocumentState = {
  status: 'connecting',
  error: null,
  files: [],
  entryPoint: '',
  filesMap: {},
  lastRun: null,
  meta: undefined,
};

function readStateFromDoc(doc: Doc<ProjectDocument>): Omit<ProjectDocumentState, 'status' | 'error'> {
  const normalized = normalizeProjectDocument(doc.data);
  const meta = normalized.meta as Record<string, unknown> | undefined;
  const lastRun = (meta?.lastRun as LastRunResult | undefined) ?? null;
  return {
    files: Object.keys(normalized.files).sort(),
    entryPoint: normalized.entryPoint,
    filesMap: normalized.files,
    lastRun,
    meta,
  };
}

function submitProjectOps(roomId: string, ops: ProjectMutationOp[]): Promise<void> {
  const connection = getShareDbConnection();
  const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;

  return new Promise((resolve, reject) => {
    if (ops.length === 0) {
      resolve();
      return;
    }
    doc.submitOp(ops, undefined, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Subscribes to the room ShareDB document and exposes project file metadata
 * and mutation helpers for the file tree (Stage 3+).
 */
export function useProjectDocument(roomId: string) {
  const [state, setState] = useState<ProjectDocumentState>(initialState);

  useEffect(() => {
    if (!roomId) return undefined;

    setState(initialState);

    const connection = getShareDbConnection();
    const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;

    const syncFromDoc = (): void => {
      if (!doc.type || doc.data === undefined) return;
      try {
        const next = readStateFromDoc(doc);
        setState((prev) => ({ ...prev, ...next, status: 'ready', error: null }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Invalid project document',
        }));
      }
    };

    doc.subscribe((err) => {
      if (err) {
        setState((prev) => ({ ...prev, status: 'error', error: err.message }));
        return;
      }
      if (!doc.type) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: `Document for room ${roomId} does not exist`,
        }));
        return;
      }
      syncFromDoc();
    });

    doc.on('op', syncFromDoc);

    return () => {
      doc.off('op', syncFromDoc);
      doc.unsubscribe(() => undefined);
    };
  }, [roomId]);

  const addFile = useCallback(
    (path: string, language: SupportedLanguage, content = ''): Promise<void> => {
      const connection = getShareDbConnection();
      const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;
      const normalized = normalizeProjectDocument(doc.data);
      assertCanAddFile(Object.keys(normalized.files).length);
      return submitProjectOps(roomId, [buildAddFileOp(path, content, language)]);
    },
    [roomId],
  );

  const renameFile = useCallback(
    (oldPath: string, newPath: string): Promise<void> => {
      const connection = getShareDbConnection();
      const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;
      const normalized = normalizeProjectDocument(doc.data);
      const file = normalized.files[oldPath];
      if (!file) throw new Error(`File not found: ${oldPath}`);
      if (normalized.files[newPath]) throw new Error(`File already exists: ${newPath}`);
      return submitProjectOps(
        roomId,
        buildRenameFileOps(oldPath, newPath, file, normalized.entryPoint),
      );
    },
    [roomId],
  );

  const deleteFile = useCallback(
    (path: string): Promise<void> => {
      const connection = getShareDbConnection();
      const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;
      const normalized = normalizeProjectDocument(doc.data);
      assertCanDeleteFile(Object.keys(normalized.files).length);
      const file = normalized.files[path];
      if (!file) throw new Error(`File not found: ${path}`);
      const ops: ProjectMutationOp[] = [];
      if (normalized.entryPoint === path) {
        const nextEntry = Object.keys(normalized.files).find((candidate) => candidate !== path);
        if (!nextEntry) throw new Error('Cannot delete the last file in a project');
        ops.push(...buildSetEntryPointOps(normalized.entryPoint, nextEntry));
      }
      ops.push(buildDeleteFileOp(path, file));
      return submitProjectOps(roomId, ops);
    },
    [roomId],
  );

  const setEntryPoint = useCallback(
    (newEntry: string): Promise<void> => {
      const connection = getShareDbConnection();
      const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;
      const normalized = normalizeProjectDocument(doc.data);
      if (!normalized.files[newEntry]) {
        throw new Error(`File not found: ${newEntry}`);
      }
      return submitProjectOps(roomId, buildSetEntryPointOps(normalized.entryPoint, newEntry));
    },
    [roomId],
  );

  const setLastRun = useCallback(
    (run: LastRunResult): Promise<void> => {
      const connection = getShareDbConnection();
      const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;
      const normalized = normalizeProjectDocument(doc.data);
      const existingMeta = normalized.meta as Record<string, unknown> | undefined;
      return submitProjectOps(roomId, buildSetLastRunOps(run, existingMeta));
    },
    [roomId],
  );

  return { ...state, addFile, renameFile, deleteFile, setEntryPoint, setLastRun };
}
