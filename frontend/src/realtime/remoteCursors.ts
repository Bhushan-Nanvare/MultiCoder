import type { editor } from 'monaco-editor';
import type { RoomPresencePeer } from '@/realtime/presenceTypes';

interface BoundCursor {
  widget: editor.IContentWidget | null;
  decorationIds: string[];
}

/**
 * Draws remote carets, name labels, and selection highlights for peers in
 * the same file. Returns a disposer that removes widgets and decorations.
 */
export function attachRemoteCursors(
  monacoEditor: editor.IStandaloneCodeEditor,
  peers: RoomPresencePeer[],
  filePath: string,
): () => void {
  const model = monacoEditor.getModel();
  if (!model) return () => undefined;

  const style = document.createElement('style');
  const bound: BoundCursor[] = [];
  const styleRules: string[] = [];

  for (const peer of peers) {
    if (peer.activeFile !== filePath) continue;
    const safeId = cssEscape(peer.presenceId);
    const selectionClass = `mc-remote-sel-${safeId}`;
    styleRules.push(`.${selectionClass} { background: ${peer.color}33; }`);

    const decorationIds: string[] = [];
    if (peer.selection && !isCollapsed(peer.selection)) {
      decorationIds.push(
        ...monacoEditor.deltaDecorations([], [
          {
            range: {
              startLineNumber: peer.selection.startLine,
              startColumn: peer.selection.startColumn,
              endLineNumber: peer.selection.endLine,
              endColumn: peer.selection.endColumn,
            },
            options: {
              inlineClassName: selectionClass,
              stickiness: 1,
            },
          },
        ]),
      );
    }

    if (peer.cursor) {
      const widget = createCursorWidget(peer);
      monacoEditor.addContentWidget(widget);
      bound.push({ widget, decorationIds });
    } else if (decorationIds.length > 0) {
      bound.push({ widget: null, decorationIds });
    }
  }

  style.textContent = styleRules.join('\n');
  document.head.appendChild(style);

  return () => {
    for (const item of bound) {
      if (item.widget) {
        monacoEditor.removeContentWidget(item.widget);
      }
      if (item.decorationIds.length > 0) {
        monacoEditor.deltaDecorations(item.decorationIds, []);
      }
    }
    style.remove();
  };
}

function isCollapsed(selection: RoomPresencePeer['selection']): boolean {
  if (!selection) return true;
  return (
    selection.startLine === selection.endLine &&
    selection.startColumn === selection.endColumn
  );
}

function createCursorWidget(peer: RoomPresencePeer): editor.IContentWidget {
  const root = document.createElement('div');
  root.style.position = 'absolute';
  root.style.pointerEvents = 'none';
  root.style.zIndex = '10';
  root.style.transform = 'translate(-1px, 0)';

  const label = document.createElement('div');
  label.textContent = peer.displayName;
  label.style.position = 'absolute';
  label.style.bottom = '100%';
  label.style.left = '0';
  label.style.background = peer.color;
  label.style.color = '#0b1220';
  label.style.fontSize = '10px';
  label.style.fontFamily = 'system-ui, sans-serif';
  label.style.lineHeight = '1';
  label.style.padding = '2px 4px';
  label.style.borderRadius = '3px';
  label.style.whiteSpace = 'nowrap';
  label.style.marginBottom = '2px';

  const caret = document.createElement('div');
  caret.style.width = '2px';
  caret.style.height = '1.2em';
  caret.style.background = peer.color;

  root.appendChild(label);
  root.appendChild(caret);

  const line = peer.cursor?.line ?? 1;
  const column = peer.cursor?.column ?? 1;

  return {
    getId: () => `mc-remote-cursor-${peer.presenceId}`,
    getDomNode: () => root,
    getPosition: () => ({
      position: { lineNumber: line, column },
      preference: [0 satisfies editor.ContentWidgetPositionPreference],
    }),
  };
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}
