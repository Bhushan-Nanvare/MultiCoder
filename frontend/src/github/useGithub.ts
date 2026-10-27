import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { GithubConnection, GithubImportResult, GithubRepoSummary } from '@/types/github';

export function useGithub(
  roomId: string,
  enabled: boolean,
): {
  connection: GithubConnection | null;
  repos: GithubRepoSummary[];
  loading: boolean;
  error: string | null;
  importingRepo: string | null;
  lastImport: GithubImportResult | null;
  refresh: () => Promise<void>;
  importRepo: (fullName: string, branch: string) => Promise<void>;
  disconnect: () => Promise<void>;
} {
  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const [repos, setRepos] = useState<GithubRepoSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<GithubImportResult | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const status = await api.githubStatus();
      setConnection(status);
      setRepos(status.connected ? await api.listGithubRepos() : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reach GitHub');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const importRepo = useCallback(
    async (fullName: string, branch: string): Promise<void> => {
      setImportingRepo(fullName);
      setError(null);
      setLastImport(null);
      try {
        setLastImport(await api.importGithubRepo({ roomId, fullName, branch }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Import failed');
      } finally {
        setImportingRepo(null);
      }
    },
    [roomId],
  );

  const disconnect = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await api.disconnectGithub();
      setRepos([]);
      setConnection({ connected: false, scope: null, connectedAt: null });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, []);

  return {
    connection,
    repos,
    loading,
    error,
    importingRepo,
    lastImport,
    refresh,
    importRepo,
    disconnect,
  };
}
