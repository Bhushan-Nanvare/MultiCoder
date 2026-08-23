import { useEffect, useState } from 'react';
import { isValidProjectPath } from '@/realtime/projectOps';

interface FilePathModalProps {
  open: boolean;
  title: string;
  submitLabel: string;
  initialPath?: string;
  existingPaths: string[];
  ignorePath?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (path: string) => void;
  onClose: () => void;
}

export function FilePathModal({
  open,
  title,
  submitLabel,
  initialPath = '',
  existingPaths,
  ignorePath,
  busy = false,
  error,
  onSubmit,
  onClose,
}: FilePathModalProps): JSX.Element | null {
  const [path, setPath] = useState(initialPath);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPath(initialPath);
      setLocalError(null);
    }
  }, [open, initialPath]);

  if (!open) return null;

  const handleSubmit = (): void => {
    const trimmed = path.trim();
    if (!isValidProjectPath(trimmed)) {
      setLocalError('Use a relative path like main.js or src/helper.js');
      return;
    }
    const taken = existingPaths.some(
      (existing) => existing === trimmed && existing !== ignorePath,
    );
    if (taken) {
      setLocalError('A file with that path already exists');
      return;
    }
    setLocalError(null);
    onSubmit(trimmed);
  };

  const displayError = localError ?? error;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid #334155',
          borderRadius: 10,
          padding: 20,
          width: '100%',
          maxWidth: 420,
          color: '#e2e8f0',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>{title}</h2>
        <label style={{ display: 'block', fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
          File path
        </label>
        <input
          type="text"
          value={path}
          disabled={busy}
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit();
            if (event.key === 'Escape') onClose();
          }}
          placeholder="src/helper.js"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#0b1220',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 10px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
          }}
          autoFocus
        />
        {displayError && (
          <p style={{ color: '#f87171', fontSize: 12, margin: '8px 0 0' }}>{displayError}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: '#1f2937',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            style={{
              background: busy ? '#1f2937' : '#2563eb',
              color: '#e2e8f0',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
