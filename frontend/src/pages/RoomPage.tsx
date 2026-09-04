import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import {
  CollaborativeEditor,
  type CollaborativeEditorHandle,
} from '@/components/editor/CollaborativeEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { OutputPanel } from '@/components/editor/OutputPanel';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { PlagiarismPanel } from '@/components/plagiarism/PlagiarismPanel';
import { FilePathModal } from '@/components/project/FilePathModal';
import { FileTree } from '@/components/project/FileTree';
import { EditorsPanel } from '@/components/project/EditorsPanel';
import { PresenceBar } from '@/components/project/PresenceBar';
import { TabBar } from '@/components/project/TabBar';
import { ReviewPanel } from '@/components/review/ReviewPanel';
import { useAuth } from '@/auth/AuthContext';
import type { ExecutionResult, RunScope } from '@/types/execution';
import type { PlagiarismResult } from '@/types/plagiarism';
import type { ReviewResult } from '@/types/review';
import type { Room, RoomMember, RoomVisibility } from '@/types/room';
import type { SnapshotSummary } from '@/types/snapshot';
import { useProjectDocument } from '@/realtime/useProjectDocument';
import { useRoomPresence } from '@/realtime/useRoomPresence';

export function RoomPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user, status: authStatus, login } = useAuth();
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
  const [activeFilePath, setActiveFilePath] = useState('');
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [treeBusy, setTreeBusy] = useState(false);
  const [runScope, setRunScope] = useState<RunScope>('project');
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const [editorsOpen, setEditorsOpen] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);

  const canEdit = Boolean(room?.canEdit);
  const project = useProjectDocument(room?.id ?? '');
  const presence = useRoomPresence({
    roomId: room?.id ?? '',
    user,
    activeFile: activeFilePath,
    enabled: Boolean(room?.id) && project.status === 'ready' && Boolean(user),
  });

  useEffect(() => {
    if (project.status !== 'ready') return;
    setActiveFilePath((current) => {
      if (current && project.files.includes(current)) return current;
      return project.entryPoint;
    });
    setOpenTabs((tabs) => {
      const stillPresent = tabs.filter((path) => project.files.includes(path));
      if (stillPresent.length > 0) return stillPresent;
      return project.entryPoint ? [project.entryPoint] : [];
    });
  }, [project.status, project.files, project.entryPoint]);

  useEffect(() => {
    if (!id || authStatus === 'loading') return undefined;
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
  }, [id, authStatus]);

  const handleCopyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openFile = useCallback((path: string): void => {
    setActiveFilePath(path);
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
  }, []);

  const closeTab = useCallback(
    (path: string): void => {
      setOpenTabs((tabs) => {
        const next = tabs.filter((tab) => tab !== path);
        setActiveFilePath((current) => {
          if (current !== path) return current;
          const fallback = next[next.length - 1] ?? project.entryPoint;
          return fallback;
        });
        return next;
      });
    },
    [project.entryPoint],
  );

  const handleCreateFile = useCallback(
    async (path: string): Promise<void> => {
      if (!room || !canEdit) return;
      setTreeBusy(true);
      setTreeError(null);
      try {
        await project.addFile(path, room.language);
        setNewFileOpen(false);
        openFile(path);
      } catch (err: unknown) {
        setTreeError(err instanceof Error ? err.message : 'Failed to add file');
      } finally {
        setTreeBusy(false);
      }
    },
    [room, canEdit, project.addFile, openFile],
  );

  const handleRenameFile = useCallback(
    async (newPath: string): Promise<void> => {
      if (!renamePath) return;
      setTreeBusy(true);
      setTreeError(null);
      try {
        await project.renameFile(renamePath, newPath);
        setOpenTabs((tabs) => tabs.map((tab) => (tab === renamePath ? newPath : tab)));
        setActiveFilePath((current) => (current === renamePath ? newPath : current));
        setRenamePath(null);
      } catch (err: unknown) {
        setTreeError(err instanceof Error ? err.message : 'Failed to rename file');
      } finally {
        setTreeBusy(false);
      }
    },
    [renamePath, project.renameFile],
  );

  const handleDeleteFile = useCallback(
    async (path: string): Promise<void> => {
      if (project.files.length <= 1) return;
      const confirmed = window.confirm(`Delete ${path}? This cannot be undone.`);
      if (!confirmed) return;
      setTreeBusy(true);
      setTreeError(null);
      try {
        await project.deleteFile(path);
        setOpenTabs((tabs) => tabs.filter((tab) => tab !== path));
      } catch (err: unknown) {
        setTreeError(err instanceof Error ? err.message : 'Failed to delete file');
      } finally {
        setTreeBusy(false);
      }
    },
    [project.files.length, project.deleteFile],
  );

  const handleEntryPointChange = useCallback(
    async (path: string): Promise<void> => {
      setTreeError(null);
      try {
        await project.setEntryPoint(path);
      } catch (err: unknown) {
        setTreeError(err instanceof Error ? err.message : 'Failed to set entry point');
      }
    },
    [project.setEntryPoint],
  );

  const handleRun = useCallback(async (): Promise<void> => {
    if (!room) return;

    const filesMap = project.filesMap;
    const liveActive = editorRef.current?.getValue();
    const files = Object.entries(filesMap).map(([path, file]) => ({
      path,
      content:
        path === activeFilePath && liveActive !== undefined ? liveActive : file.content,
    }));

    const entryPoint =
      runScope === 'file' ? activeFilePath || project.entryPoint : project.entryPoint;
    const payloadFiles =
      runScope === 'file' ? files.filter((file) => file.path === entryPoint) : files;
    const entryContent = payloadFiles.find((file) => file.path === entryPoint)?.content ?? '';

    if (!entryPoint || payloadFiles.length === 0) {
      setExecutionError('Nothing to run — no files in this project.');
      setExecutionResult(null);
      return;
    }
    if (!entryContent.trim()) {
      setExecutionError(`Nothing to run — ${entryPoint} is empty.`);
      setExecutionResult(null);
      return;
    }

    setRunning(true);
    setExecutionError(null);
    setExecutionResult(null);
    try {
      const result = await api.executeProject({
        language: room.language,
        entryPoint,
        files: payloadFiles,
      });
      setExecutionResult(result);

      // Broadcast to all connected clients via ShareDB
      if (canEdit && user) {
        project.setLastRun({
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode ?? 0,
          signal: result.signal,
          compileStderr: result.compileStderr,
          language: result.language,
          triggeredBy: user.id,
          triggeredByUsername: user.username,
          at: new Date().toISOString(),
        }).catch(() => { /* best-effort broadcast */ });
      }
    } catch (err: unknown) {
      setExecutionError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setRunning(false);
    }
  }, [room, project.filesMap, project.entryPoint, activeFilePath, runScope, canEdit, user, project.setLastRun]);

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
    setEditorsOpen(false);
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
      if (!room || !canEdit) return;
      setRestoringSnapshotId(snapshotId);
      setSnapshotsError(null);
      try {
        await api.restoreSnapshot(room.id, snapshotId);
      } catch (err: unknown) {
        setSnapshotsError(err instanceof Error ? err.message : 'Failed to restore snapshot');
      } finally {
        setRestoringSnapshotId(null);
      }
    },
    [room, canEdit],
  );

  const handleVisibilityChange = useCallback(
    async (visibility: RoomVisibility): Promise<void> => {
      if (!room) return;
      try {
        const next = await api.updateRoomVisibility(room.id, visibility);
        setRoom(next);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update visibility');
      }
    },
    [room],
  );

  const refreshMembers = useCallback(async (): Promise<void> => {
    if (!room) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const list = await api.listRoomMembers(room.id);
      setMembers(list);
    } catch (err: unknown) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load editors');
    } finally {
      setMembersLoading(false);
    }
  }, [room]);

  const handleToggleEditors = useCallback(() => {
    setEditorsOpen((prev) => {
      const next = !prev;
      if (next) void refreshMembers();
      return next;
    });
    setHistoryOpen(false);
  }, [refreshMembers]);

  const handleInviteEditor = useCallback(
    async (username: string): Promise<void> => {
      if (!room) return;
      setInviting(true);
      setMembersError(null);
      try {
        await api.addRoomMember(room.id, username);
        await refreshMembers();
      } catch (err: unknown) {
        setMembersError(err instanceof Error ? err.message : 'Failed to invite editor');
      } finally {
        setInviting(false);
      }
    },
    [room, refreshMembers],
  );

  const handleRemoveEditor = useCallback(
    async (userId: string): Promise<void> => {
      if (!room) return;
      setMembersError(null);
      try {
        await api.removeRoomMember(room.id, userId);
        await refreshMembers();
      } catch (err: unknown) {
        setMembersError(err instanceof Error ? err.message : 'Failed to remove editor');
      }
    },
    [room, refreshMembers],
  );

  const handleDeleteSnapshot = useCallback(
    async (snapshotId: string): Promise<void> => {
      if (!room || !room.isOwner) return;
      const confirmed = window.confirm('Delete this snapshot? This cannot be undone.');
      if (!confirmed) return;
      setDeletingSnapshotId(snapshotId);
      setSnapshotsError(null);
      try {
        await api.deleteSnapshot(room.id, snapshotId);
        await refreshSnapshots();
      } catch (err: unknown) {
        setSnapshotsError(err instanceof Error ? err.message : 'Failed to delete snapshot');
      } finally {
        setDeletingSnapshotId(null);
      }
    },
    [room, refreshSnapshots],
  );

  useEffect(() => () => reviewAbortRef.current?.abort(), []);

  if (authStatus === 'loading') {
    return <FullScreenMessage>Checking session…</FullScreenMessage>;
  }
  if (!id) {
    return <FullScreenMessage>Missing room id.</FullScreenMessage>;
  }
  if (error) {
    return (
      <FullScreenMessage variant="error">
        <div style={{ textAlign: 'center' }}>
          <div>{error}</div>
          {authStatus === 'unauthenticated' && (
            <button
              type="button"
              onClick={login}
              style={{
                marginTop: 16,
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Sign in with GitHub
            </button>
          )}
        </div>
      </FullScreenMessage>
    );
  }
  if (!room) {
    return <FullScreenMessage>Loading room…</FullScreenMessage>;
  }
  if (authStatus === 'unauthenticated' && room.visibility !== 'link-view') {
    return <Navigate to="/login" replace state={{ from: location }} />;
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
              {!canEdit ? ' · view only' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {room.isOwner && (
            <select
              value={room.visibility}
              onChange={(event) => void handleVisibilityChange(event.target.value as RoomVisibility)}
              title="Who can open this room"
              style={{
                background: '#0b1220',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 12,
              }}
            >
              <option value="link-edit">Link can edit</option>
              <option value="link-view">Link can view</option>
              <option value="private">Private</option>
            </select>
          )}
          {room.isOwner && (
            <button
              type="button"
              onClick={handleToggleEditors}
              style={{
                background: editorsOpen ? '#334155' : '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Editors
            </button>
          )}
          {user && <PresenceBar local={user} peers={presence.peers} />}
          {!user && (
            <button
              type="button"
              onClick={login}
              style={{
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Sign in to edit
            </button>
          )}
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
        </div>
      </header>
      <EditorToolbar
        language={room.language}
        entryPoint={project.entryPoint}
        entryPointFiles={project.files}
        entryPointDisabled={project.status !== 'ready' || !canEdit}
        readOnly={!canEdit}
        onEntryPointChange={handleEntryPointChange}
        runScope={runScope}
        onRunScopeChange={setRunScope}
        onRun={handleRun}
        running={running}
        onReview={handleReview}
        reviewing={reviewing}
        onCheckPlagiarism={handleCheckPlagiarism}
        checkingPlagiarism={checkingPlagiarism}
        onToggleHistory={handleToggleHistory}
        historyOpen={historyOpen}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <FileTree
          files={project.files}
          activeFile={activeFilePath}
          entryPoint={project.entryPoint}
          disabled={project.status !== 'ready' || treeBusy}
          readOnly={!canEdit}
          onSelect={openFile}
          onNewFile={() => {
            setTreeError(null);
            setNewFileOpen(true);
          }}
          onRename={(path) => {
            setTreeError(null);
            setRenamePath(path);
          }}
          onDelete={handleDeleteFile}
        />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <TabBar
            openTabs={openTabs}
            activeFile={activeFilePath}
            onSelect={setActiveFilePath}
            onClose={closeTab}
          />
          {treeError && (
            <div style={{ padding: '6px 12px', color: '#f87171', fontSize: 12, background: '#0f172a' }}>
              {treeError}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            {activeFilePath && project.status === 'ready' ? (
              <CollaborativeEditor
                key={activeFilePath}
                ref={editorRef}
                roomId={room.id}
                filePath={activeFilePath}
                language={room.language}
                docReady
                remotePeers={presence.peers}
                onLocalCursorChange={presence.updateCursor}
                readOnly={!canEdit}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#94a3b8',
                  fontSize: 14,
                }}
              >
                {project.status === 'error'
                  ? (project.error ?? 'Failed to load project')
                  : 'Loading project…'}
              </div>
            )}
          </div>
        </div>
      </div>
      <FilePathModal
        open={newFileOpen}
        title="New file"
        submitLabel="Create"
        existingPaths={project.files}
        busy={treeBusy}
        error={treeError}
        onSubmit={handleCreateFile}
        onClose={() => {
          setNewFileOpen(false);
          setTreeError(null);
        }}
      />
      <FilePathModal
        open={renamePath !== null}
        title="Rename file"
        submitLabel="Rename"
        initialPath={renamePath ?? ''}
        existingPaths={project.files}
        ignorePath={renamePath ?? undefined}
        busy={treeBusy}
        error={treeError}
        onSubmit={handleRenameFile}
        onClose={() => {
          setRenamePath(null);
          setTreeError(null);
        }}
      />
      <OutputPanel
        result={executionResult}
        errorMessage={executionError}
        running={running}
        sharedResult={project.lastRun}
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
        deletingId={deletingSnapshotId}
        onSave={handleSaveSnapshot}
        onRefresh={refreshSnapshots}
        onRestore={handleRestoreSnapshot}
        onDelete={handleDeleteSnapshot}
        onDismiss={() => setHistoryOpen(false)}
        readOnly={!canEdit}
        canDeleteSnapshots={Boolean(room.isOwner)}
      />
      <EditorsPanel
        open={editorsOpen}
        members={members}
        loading={membersLoading}
        errorMessage={membersError}
        inviting={inviting}
        canManage={Boolean(room.isOwner)}
        onInvite={handleInviteEditor}
        onRemove={handleRemoveEditor}
        onDismiss={() => setEditorsOpen(false)}
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
