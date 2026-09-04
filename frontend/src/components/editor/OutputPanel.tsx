import type { ExecutionResult } from '@/types/execution';
import type { LastRunResult } from '@/types/room';

interface OutputPanelProps {
  result: ExecutionResult | null;
  errorMessage: string | null;
  running: boolean;
  sharedResult?: LastRunResult | null;
}

export function OutputPanel({ result, errorMessage, running, sharedResult }: OutputPanelProps): JSX.Element {
  /** Show shared result when we have no local result, or when the shared one is newer. */
  const showShared = !running && !result && !errorMessage && sharedResult;

  return (
    <section
      style={{
        background: '#020617',
        borderTop: '1px solid #1f2937',
        color: '#e2e8f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        padding: '10px 16px',
        height: 220,
        overflow: 'auto',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
          fontSize: 12,
          opacity: 0.65,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <strong style={{ fontWeight: 600 }}>Output</strong>
        {result && (
          <>
            <span>
              {result.runtime} {result.version}
            </span>
            <span>·</span>
            <span>{result.executionTimeMs} ms</span>
            <span>·</span>
            <span>
              exit {result.exitCode ?? 'null'}
              {result.signal ? ` (${result.signal})` : ''}
            </span>
          </>
        )}
        {showShared && sharedResult.triggeredByUsername && (
          <span style={{ color: '#60a5fa' }}>
            Run by @{sharedResult.triggeredByUsername} · {new Date(sharedResult.at).toLocaleTimeString()}
          </span>
        )}
      </header>

      {running && <p style={{ opacity: 0.7 }}>Executing…</p>}

      {!running && errorMessage && (
        <pre style={{ color: '#f87171', whiteSpace: 'pre-wrap', margin: 0 }}>{errorMessage}</pre>
      )}

      {!running && !errorMessage && !result && !showShared && (
        <p style={{ opacity: 0.5 }}>Press Run to execute the project (or the active file).</p>
      )}

      {!running && result && (
        <>
          {result.compileStderr && (
            <Section title="compile stderr" color="#fbbf24" content={result.compileStderr} />
          )}
          {result.stdout && <Section title="stdout" color="#86efac" content={result.stdout} />}
          {result.stderr && <Section title="stderr" color="#f87171" content={result.stderr} />}
          {!result.stdout && !result.stderr && !result.compileStderr && (
            <p style={{ opacity: 0.5 }}>(no output)</p>
          )}
        </>
      )}

      {showShared && (
        <>
          {sharedResult.compileStderr && (
            <Section title="compile stderr" color="#fbbf24" content={sharedResult.compileStderr} />
          )}
          {sharedResult.stdout && <Section title="stdout" color="#86efac" content={sharedResult.stdout} />}
          {sharedResult.stderr && <Section title="stderr" color="#f87171" content={sharedResult.stderr} />}
          {!sharedResult.stdout && !sharedResult.stderr && !sharedResult.compileStderr && (
            <p style={{ opacity: 0.5 }}>(no output)</p>
          )}
        </>
      )}
    </section>
  );
}

interface SectionProps {
  title: string;
  color: string;
  content: string;
}

function Section({ title, color, content }: SectionProps): JSX.Element {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color, fontSize: 11, opacity: 0.85, marginBottom: 4 }}>{title}</div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</pre>
    </div>
  );
}
