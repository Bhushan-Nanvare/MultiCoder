import type { BugSeverity, ReviewResult } from '@/types/review';

interface ReviewPanelProps {
  result: ReviewResult | null;
  errorMessage: string | null;
  loading: boolean;
  streamingChars: number;
  onDismiss: () => void;
}

const severityColors: Record<BugSeverity, string> = {
  low: '#facc15',
  medium: '#fb923c',
  high: '#f87171',
};

export function ReviewPanel({
  result,
  errorMessage,
  loading,
  streamingChars,
  onDismiss,
}: ReviewPanelProps): JSX.Element | null {
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
        <strong>AI code review</strong>
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
          aria-label="Dismiss review"
        >
          ×
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ opacity: 0.85, margin: 0 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#a78bfa',
                  marginRight: 8,
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
              Streaming review…
            </p>
            <div
              style={{
                background: '#020617',
                border: '1px solid #1e293b',
                borderRadius: 6,
                padding: '8px 12px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                opacity: 0.6,
              }}
            >
              {streamingChars > 0
                ? `${streamingChars.toLocaleString()} chars received`
                : 'waiting for first token…'}
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
          </div>
        )}

        {errorMessage && !loading && (
          <pre style={{ color: '#f87171', whiteSpace: 'pre-wrap' }}>{errorMessage}</pre>
        )}

        {result && !loading && (
          <>
            <ScoreBadge score={result.score} />
            <p style={{ marginTop: 12, lineHeight: 1.5 }}>{result.summary}</p>

            <KeyValueRow label="Time complexity" value={result.timeComplexity} />
            <KeyValueRow label="Space complexity" value={result.spaceComplexity} />

            <Section title="Suggestions" empty="None">
              <ul style={listStyle}>
                {result.suggestions.map((item, idx) => (
                  <li key={idx} style={liStyle}>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Bugs" empty="None detected">
              <ul style={listStyle}>
                {result.bugs.map((bug, idx) => (
                  <li key={idx} style={liStyle}>
                    <span
                      style={{
                        background: severityColors[bug.severity],
                        color: '#0b1220',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 11,
                        marginRight: 8,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {bug.severity}
                    </span>
                    <span style={{ opacity: 0.6, marginRight: 6 }}>line {bug.line}:</span>
                    {bug.description}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Security concerns" empty="None flagged">
              <ul style={listStyle}>
                {result.securityConcerns.map((item, idx) => (
                  <li key={idx} style={liStyle}>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <footer
              style={{
                marginTop: 18,
                paddingTop: 12,
                borderTop: '1px solid #1f2937',
                fontSize: 11,
                opacity: 0.55,
              }}
            >
              {result.provider} · {result.model}
            </footer>
          </>
        )}
      </div>
    </aside>
  );
}

function ScoreBadge({ score }: { score: number }): JSX.Element {
  const color = score >= 90 ? '#86efac' : score >= 70 ? '#facc15' : '#f87171';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        background: '#020617',
        border: `1px solid ${color}`,
        padding: '6px 14px',
        borderRadius: 999,
      }}
    >
      <span style={{ color, fontSize: 22, fontWeight: 700 }}>{score}</span>
      <span style={{ opacity: 0.6 }}>/ 100</span>
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 12 }}>
      <span style={{ opacity: 0.6, width: 130 }}>{label}</span>
      <code
        style={{
          background: '#020617',
          padding: '1px 6px',
          borderRadius: 4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {value}
      </code>
    </div>
  );
}

interface SectionProps {
  title: string;
  empty: string;
  children: React.ReactNode;
}

function Section({ title, empty, children }: SectionProps): JSX.Element {
  const hasContent =
    Array.isArray(children) ||
    (children &&
      typeof children === 'object' &&
      'props' in children &&
      Array.isArray((children as { props: { children?: unknown[] } }).props.children) &&
      ((children as { props: { children: unknown[] } }).props.children.length ?? 0) > 0);

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 12, opacity: 0.7, margin: '0 0 6px', textTransform: 'uppercase' }}>
        {title}
      </h3>
      {hasContent ? children : <p style={{ opacity: 0.5, fontSize: 12 }}>{empty}</p>}
    </div>
  );
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 6,
};

const liStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 6,
  padding: '8px 10px',
  lineHeight: 1.45,
};
