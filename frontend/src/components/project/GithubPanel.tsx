import type { GithubConnection, GithubImportResult, GithubRepoSummary } from '@/types/github';

interface GithubPanelProps {
  open: boolean;
  connection: GithubConnection | null;
  repos: GithubRepoSummary[];
  loading: boolean;
  errorMessage: string | null;
  importingRepo: string | null;
  lastImport: GithubImportResult | null;
  connectUrl: string;
  onRefresh: () => void;
  onImport: (fullName: string, branch: string) => void;
  onDisconnect: () => void;
  onDismiss: () => void;
}

const buttonStyle = {
  background: '#1f2937',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
} as const;

export function GithubPanel({
  open,
  connection,
  repos,
  loading,
  errorMessage,
  importingRepo,
  lastImport,
  connectUrl,
  onRefresh,
  onImport,
  onDisconnect,
  onDismiss,
}: GithubPanelProps): JSX.Element | null {
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
          padding: '14px 16px',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <strong>Import from GitHub</strong>
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: 16 }}
        >
          ✕
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {errorMessage && <p style={{ color: '#f87171' }}>{errorMessage}</p>}

        {lastImport && (
          <p style={{ color: '#4ade80' }}>
            Imported {lastImport.fileCount} files. Entry point: {lastImport.entryPoint}
            {lastImport.skipped > 0 ? ` · ${lastImport.skipped} skipped` : ''}
          </p>
        )}

        {loading && <p style={{ opacity: 0.7 }}>Loading…</p>}

        {!loading && !connection?.connected && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ opacity: 0.8, margin: 0 }}>
              Connect your GitHub account to pull one of your public repositories into this room.
              Importing replaces every file here.
            </p>
            <a href={connectUrl} style={{ ...buttonStyle, textAlign: 'center', textDecoration: 'none' }}>
              Connect GitHub
            </a>
          </div>
        )}

        {!loading && connection?.connected && repos.length === 0 && (
          <p style={{ opacity: 0.7 }}>No repositories found on your account.</p>
        )}

        {connection?.connected &&
          repos.map((repo) => (
            <div
              key={repo.fullName}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {repo.fullName}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {repo.defaultBranch} · updated {new Date(repo.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                type="button"
                disabled={importingRepo !== null}
                onClick={() => onImport(repo.fullName, repo.defaultBranch)}
                style={{
                  ...buttonStyle,
                  cursor: importingRepo ? 'wait' : 'pointer',
                  background: importingRepo === repo.fullName ? '#334155' : '#1f2937',
                }}
              >
                {importingRepo === repo.fullName ? 'Importing…' : 'Import'}
              </button>
            </div>
          ))}
      </div>

      <footer style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #1f2937' }}>
        <button type="button" onClick={onRefresh} disabled={loading} style={buttonStyle}>
          Refresh
        </button>
        {connection?.connected && (
          <button type="button" onClick={onDisconnect} style={buttonStyle}>
            Disconnect
          </button>
        )}
      </footer>
    </aside>
  );
}
