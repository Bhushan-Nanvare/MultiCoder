import type { editor } from 'monaco-editor';
import type { Doc } from 'sharedb/lib/client';
import { fileContent, normalizeProjectDocument } from '@/realtime/documentHelpers';
import type { ProjectDocument } from '@/types/room';

type Json0Op =
  | { p: (string | number)[]; sd: string }
  | { p: (string | number)[]; si: string };

function contentPath(filePath: string, offset: number): (string | number)[] {
  return ['files', filePath, 'content', offset];
}

function isContentOp(path: unknown[], filePath: string): path is [string, string, string, number] {
  return (
    path.length === 4 &&
    path[0] === 'files' &&
    path[1] === filePath &&
    path[2] === 'content' &&
    typeof path[3] === 'number'
  );
}

/**
 * Two-way binding between Monaco and `files[filePath].content` on a ShareDB
 * ProjectDocument. Legacy v1 docs are normalized for reads until the server
 * migrates them.
 */
export function bindMonacoToShareDb(
  monacoEditor: editor.IStandaloneCodeEditor,
  doc: Doc<ProjectDocument>,
  filePath: string,
): () => void {
  const model = monacoEditor.getModel();
  if (!model) {
    throw new Error('Monaco editor has no model');
  }

  let applyingRemote = false;

  const syncFromDoc = (): void => {
    const normalized = normalizeProjectDocument(doc.data);
    const remoteContent = fileContent(normalized, filePath);
    if (model.getValue() !== remoteContent) {
      applyingRemote = true;
      model.setValue(remoteContent);
      applyingRemote = false;
    }
  };

  syncFromDoc();

  const localChangeListener = monacoEditor.onDidChangeModelContent((event) => {
    if (applyingRemote) return;

    const normalized = normalizeProjectDocument(doc.data);
    const docContent = fileContent(normalized, filePath);

    const ops = event.changes
      .slice()
      .sort((a, b) => b.rangeOffset - a.rangeOffset)
      .flatMap((change) => {
        const result: Json0Op[] = [];
        if (change.rangeLength > 0) {
          const deleted = docContent.slice(
            change.rangeOffset,
            change.rangeOffset + change.rangeLength,
          );
          if (deleted.length > 0) {
            result.push({ p: contentPath(filePath, change.rangeOffset), sd: deleted });
          }
        }
        if (change.text.length > 0) {
          result.push({ p: contentPath(filePath, change.rangeOffset), si: change.text });
        }
        return result;
      });

    if (ops.length === 0) return;
    doc.submitOp(ops, undefined, (err) => {
      if (err) {
        console.error('ShareDB submitOp failed', err);
      }
    });
  });

  const handleRemoteOp = (ops: unknown[], source: unknown): void => {
    if (source === true || source === 'local') return;
    if (!Array.isArray(ops)) return;

    applyingRemote = true;
    try {
      for (const op of ops) {
        if (!op || typeof op !== 'object') continue;
        const candidate = op as { p?: Array<string | number>; si?: string; sd?: string };
        const path = candidate.p;
        if (!path || !isContentOp(path, filePath)) continue;
        const offset = path[3];

        if (typeof candidate.sd === 'string' && candidate.sd.length > 0) {
          const start = model.getPositionAt(offset);
          const end = model.getPositionAt(offset + candidate.sd.length);
          model.applyEdits([
            {
              range: {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column,
              },
              text: '',
              forceMoveMarkers: true,
            },
          ]);
        }

        if (typeof candidate.si === 'string' && candidate.si.length > 0) {
          const position = model.getPositionAt(offset);
          model.applyEdits([
            {
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
              text: candidate.si,
              forceMoveMarkers: true,
            },
          ]);
        }
      }
    } finally {
      applyingRemote = false;
    }
  };

  doc.on('op', handleRemoteOp);

  return () => {
    localChangeListener.dispose();
    doc.off('op', handleRemoteOp);
  };
}
