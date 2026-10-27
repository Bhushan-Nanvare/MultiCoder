import {
  GITHUB_API_BASE,
  GITHUB_REPO_PAGE_SIZE,
  GITHUB_REQUEST_TIMEOUT_MS,
} from '@/constants/index.js';
import { AppError } from '@/utils/errors.js';

export interface GithubRepoSummary {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
}

export interface GithubTreeEntry {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

interface RepoResponse {
  full_name: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

interface TreeResponse {
  tree?: GithubTreeEntry[];
  truncated?: boolean;
}

interface BlobResponse {
  content: string;
  encoding: string;
}

export class GithubClient {
  constructor(private readonly token: string) {}

  async listRepositories(): Promise<GithubRepoSummary[]> {
    const repos = await this.request<RepoResponse[]>(
      `/user/repos?per_page=${GITHUB_REPO_PAGE_SIZE}&sort=updated&affiliation=owner`,
    );
    return repos.map((repo) => ({
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      private: repo.private,
      updatedAt: repo.updated_at,
    }));
  }

  async listTree(fullName: string, branch: string): Promise<GithubTreeEntry[]> {
    const tree = await this.request<TreeResponse>(
      `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );
    if (tree.truncated) {
      throw new AppError(
        'That repository is too large to import',
        413,
        'GITHUB_REPO_TOO_LARGE',
      );
    }
    return tree.tree ?? [];
  }

  async readBlob(fullName: string, sha: string): Promise<Buffer> {
    const blob = await this.request<BlobResponse>(`/repos/${fullName}/git/blobs/${sha}`);
    if (blob.encoding !== 'base64') {
      throw new AppError(`Unsupported blob encoding "${blob.encoding}"`, 502, 'GITHUB_BAD_RESPONSE');
    }
    return Buffer.from(blob.content, 'base64');
  }

  private async request<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${GITHUB_API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'multicoder',
        },
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new AppError('GitHub did not respond in time', 504, 'GITHUB_TIMEOUT');
      }
      throw new AppError(`GitHub request failed: ${(err as Error).message}`, 502, 'GITHUB_UNAVAILABLE');
    }

    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'GitHub rejected the stored token — reconnect your account',
        401,
        'GITHUB_TOKEN_REJECTED',
      );
    }
    if (response.status === 404) {
      throw new AppError('Repository or branch not found', 404, 'GITHUB_NOT_FOUND');
    }
    if (!response.ok) {
      throw new AppError(`GitHub request failed (${response.status})`, 502, 'GITHUB_ERROR');
    }

    return (await response.json()) as T;
  }
}
