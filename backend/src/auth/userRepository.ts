import type { PrismaClient, User as PrismaUser } from '@prisma/client';
import type { AuthUser, GithubProfile } from '@/auth/types.js';

function toAuthUser(row: PrismaUser): AuthUser {
  if (!row.githubId) {
    throw new Error(`User ${row.id} has no githubId — only GitHub-authed users supported in Phase 2B`);
  }
  return {
    id: row.id,
    githubId: row.githubId,
    username: row.username,
    displayName: row.displayName,
    email: row.email,
    avatarUrl: row.avatarUrl,
  };
}

export interface UserRepository {
  findById(id: string): Promise<AuthUser | null>;
  findByGithubId(githubId: string): Promise<AuthUser | null>;
  upsertFromGithub(profile: GithubProfile): Promise<AuthUser>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toAuthUser(row) : null;
  }

  async findByGithubId(githubId: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({ where: { githubId } });
    return row ? toAuthUser(row) : null;
  }

  async upsertFromGithub(profile: GithubProfile): Promise<AuthUser> {
    const row = await this.prisma.user.upsert({
      where: { githubId: profile.githubId },
      create: {
        githubId: profile.githubId,
        username: profile.username,
        displayName: profile.displayName,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
      update: {
        username: profile.username,
        displayName: profile.displayName,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
    });
    return toAuthUser(row);
  }
}
