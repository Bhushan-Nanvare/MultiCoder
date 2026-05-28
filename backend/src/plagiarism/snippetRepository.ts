import type { PrismaClient } from '@prisma/client';
import type { SupportedLanguage } from '@/constants/index.js';

export interface StoredSnippet {
  id: string;
  language: SupportedLanguage;
  fingerprintCount: number;
  createdAt: Date;
  ownerId: string | null;
  ownerUsername: string | null;
}

export interface FingerprintMatch {
  snippetId: string;
  matchedCount: number;
  language: SupportedLanguage;
  candidateFingerprintCount: number;
  ownerId: string | null;
  ownerUsername: string | null;
  createdAt: Date;
}

export interface SnippetRepository {
  storeSnippet(input: {
    ownerId: string | null;
    language: SupportedLanguage;
    code: string;
    fingerprints: string[];
  }): Promise<StoredSnippet>;
  findMatches(input: {
    language: SupportedLanguage;
    fingerprints: string[];
    excludeOwnerId: string | null;
    limit: number;
  }): Promise<FingerprintMatch[]>;
}

export class PrismaSnippetRepository implements SnippetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async storeSnippet(input: {
    ownerId: string | null;
    language: SupportedLanguage;
    code: string;
    fingerprints: string[];
  }): Promise<StoredSnippet> {
    const created = await this.prisma.snippet.create({
      data: {
        ownerId: input.ownerId,
        language: input.language,
        code: input.code,
        fingerprintCount: input.fingerprints.length,
        fingerprints: {
          create: input.fingerprints.map((hash) => ({ hash })),
        },
      },
      include: { owner: { select: { username: true } } },
    });
    return {
      id: created.id,
      language: created.language as SupportedLanguage,
      fingerprintCount: created.fingerprintCount,
      createdAt: created.createdAt,
      ownerId: created.ownerId,
      ownerUsername: created.owner?.username ?? null,
    };
  }

  async findMatches(input: {
    language: SupportedLanguage;
    fingerprints: string[];
    excludeOwnerId: string | null;
    limit: number;
  }): Promise<FingerprintMatch[]> {
    if (input.fingerprints.length === 0) return [];

    // Pull every fingerprint row whose hash appears in the query set. For
    // realistic snippet sizes this stays small; if the catalog grows large
    // this is the place to add a hash-bucketed pre-filter.
    const rows = await this.prisma.fingerprint.findMany({
      where: {
        hash: { in: input.fingerprints },
        snippet: {
          language: input.language,
          ...(input.excludeOwnerId ? { ownerId: { not: input.excludeOwnerId } } : {}),
        },
      },
      select: { snippetId: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.snippetId, (counts.get(row.snippetId) ?? 0) + 1);
    }
    if (counts.size === 0) return [];

    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, input.limit)
      .map(([id]) => id);

    const snippets = await this.prisma.snippet.findMany({
      where: { id: { in: topIds } },
      include: { owner: { select: { username: true } } },
    });

    return snippets
      .map((snippet) => ({
        snippetId: snippet.id,
        matchedCount: counts.get(snippet.id) ?? 0,
        language: snippet.language as SupportedLanguage,
        candidateFingerprintCount: snippet.fingerprintCount,
        ownerId: snippet.ownerId,
        ownerUsername: snippet.owner?.username ?? null,
        createdAt: snippet.createdAt,
      }))
      .sort((a, b) => b.matchedCount - a.matchedCount);
  }
}
