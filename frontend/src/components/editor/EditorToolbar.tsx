import type { SupportedLanguage } from '@/types/room';

interface EditorToolbarProps {
  language: SupportedLanguage;
  onRun: () => void;
  running: boolean;
  onReview: () => void;
  reviewing: boolean;
  onCheckPlagiarism: () => void;
  checkingPlagiarism: boolean;
  onToggleHistory: () => void;
  historyOpen: boolean;
}

export function EditorToolbar({
  language,
  onRun,
  running,
  onReview,
  reviewing,
  onCheckPlagiarism,
  checkingPlagiarism,
  onToggleHistory,
  historyOpen,
}: EditorToolbarProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: '#111827',
        borderBottom: '1px solid #1f2937',
        color: '#e2e8f0',
        fontSize: 13,
      }}
    >
      <span style={{ opacity: 0.65 }}>Language:</span>
      <code
        style={{
          background: '#0b1220',
          padding: '2px 8px',
          borderRadius: 4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {language}
      </code>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onToggleHistory}
        style={{
          background: historyOpen ? '#334155' : '#1f2937',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden>⟳</span>
        History
      </button>
      <button
        type="button"
        onClick={onCheckPlagiarism}
        disabled={checkingPlagiarism}
        style={{
          background: checkingPlagiarism ? '#1f2937' : '#0891b2',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: checkingPlagiarism ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden>⧉</span>
        {checkingPlagiarism ? 'Checking…' : 'Check plagiarism'}
      </button>
      <button
        type="button"
        onClick={onReview}
        disabled={reviewing}
        style={{
          background: reviewing ? '#1f2937' : '#7c3aed',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: reviewing ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden>✦</span>
        {reviewing ? 'Reviewing…' : 'AI review'}
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        style={{
          background: running ? '#1f2937' : '#16a34a',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: running ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden>▶</span>
        {running ? 'Running…' : 'Run'}
      </button>
    </div>
  );
}
