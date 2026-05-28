import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import {
  CollaborativeEditor,
  type CollaborativeEditorHandle,
} from '@/components/editor/CollaborativeEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { OutputPanel } from '@/components/editor/OutputPanel';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { PlagiarismPanel } from '@/components/plagiarism/PlagiarismPanel';
import { ReviewPanel } from '@/components/review/ReviewPanel';
import type { ExecutionResult } from '@/types/execution';
import type { PlagiarismResult } from '@/types/plagiarism';
import type { ReviewResult } from '@/types/review';
import type { Room } from '@/types/room';
import type { SnapshotSummary } from '@/types/snapshot';

export function RoomPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const editorRef = useRef<CollaborativeEditorHandle>(null);
  const reviewAbortRef = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewStreamChars, setReviewStreamChars] = useState(0);
  const [checkingPlagiarism, setCheckingPlagiarism] = useState(false);
  const [plagiarismResult, setPlagiarismResult] = useState<PlagiarismResult | null>(null);
  const [plagiarismError, setPlagiarismError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    api
      .getRoom(id)
      .then((data) => {
        if (!cancelled) setRoom(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load room');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleCopyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = useCallback(async (): Promise<void> => {
    if (!room) return;
    const code = editorRef.current?.getValue() ?? '';
    if (!code.trim()) {
      setExecutionError('Nothing to run — the editor is empty.');
      setExecutionResult(null);
      return;
    }
    setRunning(true);
    setExecutionError(null);
    setExecutionResult(null);
    try {
      const result = await api.executeCode({ language: room.language, code });
      setExecutionResult(result);
    } catch (err: unknown) {
      setExecutionError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setRunning(false);
    }
  }, [room]);

  const handleReview = useCallback(async (): Promise<void> => {
    if (!room) return;
    const code = editorRef.current?.getValue() ?? '';
    if (!code.trim()) {
      setReviewError('Nothing to review — the editor is empty.');
      setReviewResult(null);
      return;
    }

    reviewAbortRef.current?.abort();
    const controller = new AbortController();
    reviewAbortRef.current = controller;

    setReviewing(true);
    setReviewError(null);
    setReviewResult(null);
    setReviewStreamChars(0);

    try {
      await api.reviewCodeStream(
        { language: room.language, code },
        {
          onChunk: (text) => {
            setReviewStreamChars((prev) => prev + text.length);
          },
          onResult: (result) => {
            setReviewResult(result);
          },
          onError: (message) => {
            setReviewError(message);
          },
        },
        controller.signal,
      );
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setReviewError(err instanceof Error ? err.message : 'AI review failed');
    } finally {
      setReviewing(false);
      if (reviewAbortRef.current === controller) {
        reviewAbortRef.current = null;
      }
    }
  }, [room]);

  const handleDismissReview = useCallback(() => {
    reviewAbortRef.current?.abort();
    setReviewResult(null);
    setReviewError(null);
    setReviewStreamChars(0);
  }, []);

  const handleCheckPlagiarism = useCallback(async (): Promise<void> => {
    if (!room) return;
    const code = editorRef.current?.getValue() ?? '';
    if (!code.trim()) {
      setPlagiarismError('Nothing to check — the editor is empty.');
      setPlagiarismResult(null);
      return;
    }
    setCheckingPlagiarism(true);
    setPlagiarismError(null);
    setPlagiarismResult(null);
    try {
      const result = await api.checkPlagiarism({ language: room.language, code, store: true });
      setPlagiarismResult(result);
    } catch (err: unknown) {
      setPlagiarismError(err instanceof Error ? err.message : 'Plagiarism check failed');
    } finally {
      setCheckingPlagiarism(false);
    }
  }, [room]);

  const handleDismissPlagiarism = useCallback(() => {
    setPlagiarismResult(null);
    setPlagiarismError(null);
  }, []);

  const refreshSnapshots = useCallback(async (): Promise<void> => {
    if (!room) return;
    setSnapshotsLoading(true);
    setSnapshotsError(null);
    try {
      const list = await api.listSnapshots(room.id);
      setSnapshots(list);
    } catch (err: unknown) {
      setSnapshotsError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setSnapshotsLoading(false);
    }
  }, [room]);

  const handleToggleHistory = useCallback(() => {
    setHistoryOpen((prev) => {
      const next = !prev;
      if (next) void refreshSnapshots();
      return next;
    });
  }, [refreshSnapshots]);

  const handleSaveSnapshot = useCallback(async (): Promise<void> => {
    if (!room) return;
    setSavingSnapshot(true);
    setSnapshotsError(null);
    try {
      await api.saveSnapshot(room.id);
      await refreshSnapshots();
    } catch (err: unknown) {
      setSnapshotsError(err instanceof Error ? err.message : 'Failed to save snapshot');
    } finally {
      setSavingSnapshot(false);
    }
  }, [room, refreshSnapshots]);

  const handleRestoreSnapshot = useCallback(
    async (snapshotId: string): Promise<void> => {
      if (!room) return;
      setRestoringSnapshotId(snapshotId);
      setSnapshotsError(null);
      try {
        const snapshot = await api.getSnapshot(room.id, snapshotId);
        editorRef.current?.setValue(snapshot.content);
      } catch (err: unknown) {
        setSnapshotsError(err instanceof Error ? err.message : 'Failed to restore snapshot');
      } finally {
        setRestoringSnapshotId(null);
      }
    },
    [room],
  );

  useEffect(() => () => reviewAbortRef.current?.abort(), []);

  if (!id) {
    return <FullScreenMessage>Missing room id.</FullScreenMessage>;
  }
  if (error) {
    return <FullScreenMessage variant="error">{error}</FullScreenMessage>;
  }
  if (!room) {
    return <FullScreenMessage>Loading room…</FullScreenMessage>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#020617',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #1e293b',
          background: '#0b1220',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/dashboard" style={{ color: '#60a5fa', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <div>
            <div style={{ fontWeight: 600 }}>{room.name}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {room.language} · {room.id}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          style={{
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </header>
      <EditorToolbar
        language={room.language}
        onRun={handleRun}
        running={running}
        onReview={handleReview}
        reviewing={reviewing}
        onCheckPlagiarism={handleCheckPlagiarism}
        checkingPlagiarism={checkingPlagiarism}
        onToggleHistory={handleToggleHistory}
        historyOpen={historyOpen}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <CollaborativeEditor ref={editorRef} roomId={room.id} language={room.language} />
      </div>
      <OutputPanel
        result={executionResult}
        errorMessage={executionError}
        running={running}
      />
      <ReviewPanel
        result={reviewResult}
        errorMessage={reviewError}
        loading={reviewing}
        streamingChars={reviewStreamChars}
        onDismiss={handleDismissReview}
      />
      <PlagiarismPanel
        result={plagiarismResult}
        errorMessage={plagiarismError}
        loading={checkingPlagiarism}
        onDismiss={handleDismissPlagiarism}
      />
      <HistoryPanel
        open={historyOpen}
        snapshots={snapshots}
        loading={snapshotsLoading}
        errorMessage={snapshotsError}
        savingNow={savingSnapshot}
        restoringId={restoringSnapshotId}
        onSave={handleSaveSnapshot}
        onRefresh={refreshSnapshots}
        onRestore={handleRestoreSnapshot}
        onDismiss={() => setHistoryOpen(false)}
      />
    </div>
  );
}

interface FullScreenMessageProps {
  variant?: 'info' | 'error';
  children: React.ReactNode;
}

function FullScreenMessage({ variant = 'info', children }: FullScreenMessageProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#020617',
        color: variant === 'error' ? '#f87171' : '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  );
}
