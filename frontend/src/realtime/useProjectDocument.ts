import { useCallback, useEffect, useState } from 'react';
import type { Doc } from 'sharedb/lib/client';
import { normalizeProjectDocument } from '@/realtime/documentHelpers';
import { buildAddFileOp } from '@/realtime/projectOps';
import { SHAREDB_COLLECTION, getShareDbConnection } from '@/realtime/sharedbConnection';
import type { ProjectDocument, SupportedLanguage } from '@/types/room';

interface ProjectDocumentState {
  status: 'connecting' | 'ready' | 'error';
  error: string | null;
  files: string[];
  entryPoint: string;
}

const initialState: ProjectDocumentState = {
  status: 'connecting',
  error: null,
  files: [],
  entryPoint: '',
};

function readStateFromDoc(doc: Doc<ProjectDocument>): Omit<ProjectDocumentState, 'status' | 'error'> {
  const normalized = normalizeProjectDocument(doc.data);
  return {
    files: Object.keys(normalized.files).sort(),
    entryPoint: normalized.entryPoint,
  };
}

/**
 * Subscribes to the room ShareDB document and exposes project file metadata
 * for the file switcher (Stage 2.2).
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

      return new Promise((resolve, reject) => {
        const op = buildAddFileOp(path, content, language);
        doc.submitOp([op], undefined, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    [roomId],
  );

  return { ...state, addFile };
}
