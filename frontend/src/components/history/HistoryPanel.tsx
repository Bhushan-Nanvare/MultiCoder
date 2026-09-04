import type { CSSProperties } from 'react';
import type { SnapshotSummary } from '@/types/snapshot';

interface HistoryPanelProps {
  open: boolean;
  snapshots: SnapshotSummary[];
  loading: boolean;
  errorMessage: string | null;
  savingNow: boolean;
  restoringId: string | null;
  deletingId: string | null;
  onSave: () => void;
  onRefresh: () => void;
  onRestore: (snapshotId: string) => void;
  onDelete?: (snapshotId: string) => void;
  onDismiss: () => void;
  readOnly?: boolean;
  canDeleteSnapshots?: boolean;
}

export function HistoryPanel({
  open,
  snapshots,
  loading,
  errorMessage,
  savingNow,
  restoringId,
  deletingId,
  onSave,
  onRefresh,
  onRestore,
  onDelete,
  onDismiss,
  readOnly = false,
  canDeleteSnapshots = false,
}: HistoryPanelProps): JSX.Element | null {
  if (!open) return null;

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: 420,
        background: '#0b1220',
        borderLeft: '1px solid #1f2937',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        boxShadow: '-12px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <strong>History</strong>
        <button
          type="button"
          onClick={onDismiss}
          style={dismissButtonStyle}
          aria-label="Dismiss history"
        >
          ×
        </button>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 18px',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <button
          type="button"
          onClick={onSave}
          disabled={savingNow || readOnly}
          style={{
            ...actionButtonStyle,
            background: savingNow ? '#1f2937' : '#2563eb',
          }}
        >
          {savingNow ? 'Saving…' : 'Save snapshot now'}
        </button>
        <button type="button" onClick={onRefresh} disabled={loading} style={secondaryButtonStyle}>
          Refresh
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
        {loading && <p style={{ opacity: 0.7 }}>Loading snapshots…</p>}

        {errorMessage && (
          <pre style={{ color: '#f87171', whiteSpace: 'pre-wrap' }}>{errorMessage}</pre>
        )}

        {!loading && snapshots.length === 0 && (
          <p style={{ opacity: 0.55 }}>
            No snapshots yet. Click <strong>Save snapshot now</strong> to capture the current
            project.
          </p>
        )}

        <ul style={listStyle}>
          {snapshots.map((snap) => {
            const restoring = restoringId === snap.id;
            return (
              <li key={snap.id} style={liStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {new Date(snap.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                      {snap.fileCount} {snap.fileCount === 1 ? 'file' : 'files'} · entry{' '}
                      <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                        {snap.entryPoint}
                      </code>
                      {snap.snapshotVersion === 1 ? ' · legacy' : ''}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                      {snap.createdByUsername ? '@' + snap.createdByUsername : 'anonymous'} ·{' '}
                      {formatBytes(snap.byteSize)} ·{' '}
                      <code
                        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
                      >
                        {snap.id.slice(0, 10)}…
                      </code>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onRestore(snap.id)}
                    disabled={restoring || readOnly}
                    style={{
                      ...secondaryButtonStyle,
                      whiteSpace: 'nowrap',
                      background: restoring ? '#1f2937' : '#0b1220',
                    }}
                  >
                    {restoring ? 'Restoring…' : 'Restore'}
                  </button>
                  {canDeleteSnapshots && onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(snap.id)}
                      disabled={restoring || deletingId === snap.id}
                      style={{
                        ...secondaryButtonStyle,
                        whiteSpace: 'nowrap',
                        color: '#f87171',
                        borderColor: '#7f1d1d',
                        background: deletingId === snap.id ? '#1f2937' : '#0b1220',
                      }}
                    >
                      {deletingId === snap.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <footer
        style={{
          padding: '10px 18px',
          borderTop: '1px solid #1f2937',
          fontSize: 11,
          opacity: 0.55,
          lineHeight: 1.5,
        }}
      >
        Restoring overwrites the live project for every connected peer.
      </footer>
    </aside>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const dismissButtonStyle: CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: 'none',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
};

const actionButtonStyle: CSSProperties = {
  flex: 1,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  background: '#0b1220',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 8,
};

const liStyle: CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 6,
  padding: '10px 12px',
};
