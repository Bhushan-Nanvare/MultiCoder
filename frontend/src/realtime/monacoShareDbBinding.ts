import type { editor } from 'monaco-editor';
import type { Doc } from 'sharedb/lib/client';
import type { RoomDocument } from '@/types/room';

/**
 * Two-way binding between a Monaco editor and a ShareDB document holding
 * `{ content: string, language: SupportedLanguage }`. Local Monaco edits are
 * translated into JSON0 string operations on `content`; remote ops are
 * re-applied to the model.
 *
 * Returns a disposer that removes both listeners.
 */
export function bindMonacoToShareDb(
  monacoEditor: editor.IStandaloneCodeEditor,
  doc: Doc<RoomDocument>,
): () => void {
  const model = monacoEditor.getModel();
  if (!model) {
    throw new Error('Monaco editor has no model');
  }

  let applyingRemote = false;

  const remoteContent = doc.data?.content ?? '';
  if (model.getValue() !== remoteContent) {
    applyingRemote = true;
    model.setValue(remoteContent);
    applyingRemote = false;
  }

  const localChangeListener = monacoEditor.onDidChangeModelContent((event) => {
    if (applyingRemote) return;

    const ops = event.changes
      .slice()
      .sort((a, b) => b.rangeOffset - a.rangeOffset)
      .flatMap((change) => {
        const result: Array<
          { p: (string | number)[]; sd: string } | { p: (string | number)[]; si: string }
        > = [];
        if (change.rangeLength > 0) {
          const docContent = (doc.data?.content ?? '').toString();
          const deleted = docContent.slice(
            change.rangeOffset,
            change.rangeOffset + change.rangeLength,
          );
          if (deleted.length > 0) {
            result.push({ p: ['content', change.rangeOffset], sd: deleted });
          }
        }
        if (change.text.length > 0) {
          result.push({ p: ['content', change.rangeOffset], si: change.text });
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
        const candidate = op as {
          p?: Array<string | number>;
          si?: string;
          sd?: string;
        };
        const path = candidate.p;
        if (!path || path[0] !== 'content') continue;
        const offset = typeof path[1] === 'number' ? path[1] : 0;

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
