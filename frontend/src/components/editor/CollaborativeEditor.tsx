import Editor, { type OnMount } from '@monaco-editor/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { editor } from 'monaco-editor';
import type { Doc } from 'sharedb/lib/client';
import { bindMonacoToShareDb } from '@/realtime/monacoShareDbBinding';
import { SHAREDB_COLLECTION, getShareDbConnection } from '@/realtime/sharedbConnection';
import type { ProjectDocument, SupportedLanguage } from '@/types/room';

interface CollaborativeEditorProps {
  roomId: string;
  filePath: string;
  language: SupportedLanguage;
  /** When false, waits for the parent hook to finish subscribing. */
  docReady: boolean;
}

export interface CollaborativeEditorHandle {
  getValue(): string;
  /**
   * Overwrite the entire editor contents. The existing Monaco↔ShareDB binding
   * will translate this into a delete+insert pair on the ShareDB document, so
   * all connected peers see the change.
   */
  setValue(text: string): void;
}

const monacoLanguageMap: Record<SupportedLanguage, string> = {
  javascript: 'javascript',
  python: 'python',
  cpp: 'cpp',
};

export const CollaborativeEditor = forwardRef<
  CollaborativeEditorHandle,
  CollaborativeEditorProps
>(function CollaborativeEditor({ roomId, filePath, language, docReady }, ref) {
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const disposerRef = useRef<(() => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => editorRef.current?.getValue() ?? '',
      setValue: (text: string) => {
        editorRef.current?.setValue(text);
      },
    }),
    [],
  );

  const bindEditor = useCallback(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance || !docReady) return undefined;

    const connection = getShareDbConnection();
    const doc = connection.get(SHAREDB_COLLECTION, roomId) as Doc<ProjectDocument>;

    if (!doc.type) {
      setStatus('error');
      setErrorMessage(`Document for room ${roomId} does not exist`);
      return undefined;
    }

    try {
      disposerRef.current?.();
      disposerRef.current = bindMonacoToShareDb(editorInstance, doc, filePath);
      setStatus('ready');
      setErrorMessage(null);
    } catch (bindErr) {
      setStatus('error');
      setErrorMessage(bindErr instanceof Error ? bindErr.message : 'Invalid room document');
    }

    return () => {
      disposerRef.current?.();
      disposerRef.current = null;
    };
  }, [roomId, filePath, docReady]);

  useEffect(() => {
    if (!docReady) {
      setStatus('connecting');
      return undefined;
    }
    return bindEditor();
  }, [bindEditor, docReady]);

  const handleMount: OnMount = (instance) => {
    editorRef.current = instance;
    bindEditor();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: '6px 12px',
          background: '#0f172a',
          color: '#e2e8f0',
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {status === 'connecting' && <span>Connecting to room…</span>}
        {status === 'ready' && (
          <span>
            Connected · {filePath} · room {roomId}
          </span>
        )}
        {status === 'error' && <span style={{ color: '#f87171' }}>Error: {errorMessage}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          theme="vs-dark"
          language={monacoLanguageMap[language]}
          defaultValue=""
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
          onMount={handleMount}
        />
      </div>
    </div>
  );
});
