import { connectCallbackUrl, exchangeCodeForToken } from '@/auth/githubOAuth.js';
import type { UserRepository } from '@/auth/userRepository.js';
import { config } from '@/config/index.js';
import { GithubClient, type GithubRepoSummary } from '@/github/githubClient.js';
import {
  buildProjectFromFiles,
  isProbablyText,
  selectImportableEntries,
  type ImportedFile,
} from '@/github/repoProject.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import { isOwner } from '@/rooms/access.js';
import type { RoomService } from '@/rooms/roomService.js';
import { AppError, ForbiddenError } from '@/utils/errors.js';
import { decryptSecret, encryptSecret } from '@/utils/secrets.js';
import { logger } from '@/utils/logger.js';

export interface GithubConnectionView {
  connected: boolean;
  scope: string | null;
  connectedAt: string | null;
}

export interface ImportResult {
  fileCount: number;
  entryPoint: string;
  skipped: number;
}

export class GithubService {
  constructor(
    private readonly users: UserRepository,
    private readonly rooms: RoomService,
    private readonly documents: RealtimeDocumentService,
  ) {}

  assertEnabled(): void {
    if (!config.githubIntegrationEnabled) {
      throw new AppError(
        'GitHub integration is not configured on this server',
        503,
        'INTEGRATION_NOT_CONFIGURED',
      );
    }
  }

  async connectionFor(userId: string): Promise<GithubConnectionView> {
    if (!config.githubIntegrationEnabled) {
      return { connected: false, scope: null, connectedAt: null };
    }
    const connection = await this.users.findGithubConnection(userId);
    return connection
      ? {
          connected: true,
          scope: connection.scope,
          connectedAt: connection.connectedAt.toISOString(),
        }
      : { connected: false, scope: null, connectedAt: null };
  }

  async saveConnection(userId: string, code: string): Promise<void> {
    this.assertEnabled();
    const { accessToken, scope } = await exchangeCodeForToken(code, connectCallbackUrl());
    await this.users.saveGithubConnection(userId, { token: encryptSecret(accessToken), scope });
    logger.info({ userId, scope }, 'GitHub repository access connected');
  }

  async disconnect(userId: string): Promise<void> {
    await this.users.clearGithubConnection(userId);
  }

  async listRepositories(userId: string): Promise<GithubRepoSummary[]> {
    const client = await this.clientFor(userId);
    return client.listRepositories();
  }

  async importRepository(
    userId: string,
    roomId: string,
    fullName: string,
    branch?: string,
  ): Promise<ImportResult> {
    const room = await this.rooms.get(roomId);
    if (!isOwner(room, userId)) {
      throw new ForbiddenError('Only the room owner can import a repository');
    }

    const client = await this.clientFor(userId);
    const repos = await client.listRepositories();
    const repo = repos.find((candidate) => candidate.fullName === fullName);
    if (!repo) {
      throw new AppError('You do not own that repository', 404, 'GITHUB_NOT_FOUND');
    }

    const entries = await client.listTree(fullName, branch ?? repo.defaultBranch);
    const importable = selectImportableEntries(entries);

    const files: ImportedFile[] = [];
    for (const entry of importable) {
      const bytes = await client.readBlob(fullName, entry.sha);
      if (!isProbablyText(bytes)) continue;
      files.push({ path: entry.path, content: bytes.toString('utf8') });
    }

    const project = buildProjectFromFiles(files, room.language);
    await this.documents.replaceProject(roomId, project);
    logger.info({ roomId, fullName, fileCount: files.length }, 'Imported repository into room');

    return {
      fileCount: files.length,
      entryPoint: project.entryPoint,
      skipped: entries.filter((entry) => entry.type === 'blob').length - files.length,
    };
  }

  private async clientFor(userId: string): Promise<GithubClient> {
    this.assertEnabled();
    const connection = await this.users.findGithubConnection(userId);
    if (!connection) {
      throw new AppError('Connect your GitHub account first', 412, 'GITHUB_NOT_CONNECTED');
    }
    return new GithubClient(decryptSecret(connection.token));
  }
}
