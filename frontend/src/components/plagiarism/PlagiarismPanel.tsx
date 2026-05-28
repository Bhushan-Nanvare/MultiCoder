import type { PlagiarismResult } from '@/types/plagiarism';

interface PlagiarismPanelProps {
  result: PlagiarismResult | null;
  errorMessage: string | null;
  loading: boolean;
  onDismiss: () => void;
}

export function PlagiarismPanel({
  result,
  errorMessage,
  loading,
  onDismiss,
}: PlagiarismPanelProps): JSX.Element | null {
  if (!loading && !errorMessage && !result) return null;

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
        <strong>Plagiarism check</strong>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-label="Dismiss plagiarism panel"
        >
          ×
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
        {loading && <p style={{ opacity: 0.75 }}>Hashing & comparing fingerprints…</p>}

        {errorMessage && !loading && (
          <pre style={{ color: '#f87171', whiteSpace: 'pre-wrap' }}>{errorMessage}</pre>
        )}

        {result && !loading && (
          <>
            <SimilarityBadge score={result.similarityScore} />

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>
              {result.fingerprintCount} fingerprints computed via winnowing
              {result.stored && (
                <>
                  {' · '}stored as <code>{result.stored.snippetId.slice(0, 8)}…</code>
                </>
              )}
            </div>

            <h3
              style={{
                fontSize: 12,
                opacity: 0.7,
                margin: '20px 0 8px',
                textTransform: 'uppercase',
              }}
            >
              Top matches
            </h3>
            {result.matches.length === 0 ? (
              <p style={{ opacity: 0.5, fontSize: 12 }}>
                No matching snippets in the catalog. (You may be the first.)
              </p>
            ) : (
              <ul style={listStyle}>
                {result.matches.map((match) => (
                  <li key={match.snippetId} style={liStyle}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{match.similarity}% similar</span>
                      <span style={{ opacity: 0.5, fontSize: 11 }}>
                        {new Date(match.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                      {match.ownerUsername ? '@' + match.ownerUsername : 'anonymous'} ·
                      <span style={{ fontFamily: 'ui-monospace, monospace', marginLeft: 4 }}>
                        {match.snippetId.slice(0, 12)}…
                      </span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                      {match.matchedFingerprints}/{match.candidateFingerprintCount} fingerprints
                      overlap
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <footer
              style={{
                marginTop: 20,
                paddingTop: 12,
                borderTop: '1px solid #1f2937',
                fontSize: 11,
                opacity: 0.55,
                lineHeight: 1.5,
              }}
            >
              Comparison uses Jaccard similarity over winnowed Rabin-Karp k-grams
              (k=5, w=4) on whitespace-/comment-stripped source.
            </footer>
          </>
        )}
      </div>
    </aside>
  );
}

function SimilarityBadge({ score }: { score: number }): JSX.Element {
  const color = score >= 70 ? '#f87171' : score >= 40 ? '#facc15' : '#86efac';
  const label = score >= 70 ? 'High similarity' : score >= 40 ? 'Some overlap' : 'Original-ish';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 10,
        background: '#020617',
        border: `1px solid ${color}`,
        padding: '8px 16px',
        borderRadius: 999,
      }}
    >
      <span style={{ color, fontSize: 22, fontWeight: 700 }}>{score}%</span>
      <span style={{ opacity: 0.7, fontSize: 12 }}>{label}</span>
    </div>
  );
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 8,
};

const liStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 6,
  padding: '10px 12px',
};
