export interface GithubConnection {
  connected: boolean;
  scope: string | null;
  connectedAt: string | null;
}

export interface GithubRepoSummary {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
}

export interface GithubImportResult {
  fileCount: number;
  entryPoint: string;
  skipped: number;
}
