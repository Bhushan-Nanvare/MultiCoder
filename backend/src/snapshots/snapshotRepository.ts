import type { PrismaClient } from '@prisma/client';
import type { SnapshotDetail, SnapshotSummary } from '@/snapshots/types.js';

export interface SnapshotRepository {
  create(input: {
    roomId: string;
    content: string;
    createdBy: string | null;
  }): Promise<SnapshotDetail>;
  list(roomId: string): Promise<SnapshotSummary[]>;
  findById(roomId: string, snapshotId: string): Promise<SnapshotDetail | null>;
  countForRoom(roomId: string): Promise<number>;
  deleteOldest(roomId: string, keep: number): Promise<number>;
}

export class PrismaSnapshotRepository implements SnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    roomId: string;
    content: string;
    createdBy: string | null;
  }): Promise<SnapshotDetail> {
    const row = await this.prisma.snapshot.create({
      data: {
        roomId: input.roomId,
        content: input.content,
        createdBy: input.createdBy,
      },
      include: { author: { select: { username: true } } },
    });
    return {
      id: row.id,
      roomId: row.roomId,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      createdByUsername: row.author?.username ?? null,
      byteSize: Buffer.byteLength(row.content, 'utf8'),
      content: row.content,
    };
  }

  async list(roomId: string): Promise<SnapshotSummary[]> {
    const rows = await this.prisma.snapshot.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { username: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      roomId: row.roomId,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      createdByUsername: row.author?.username ?? null,
      byteSize: Buffer.byteLength(row.content, 'utf8'),
    }));
  }

  async findById(roomId: string, snapshotId: string): Promise<SnapshotDetail | null> {
    const row = await this.prisma.snapshot.findFirst({
      where: { id: snapshotId, roomId },
      include: { author: { select: { username: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      roomId: row.roomId,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      createdByUsername: row.author?.username ?? null,
      byteSize: Buffer.byteLength(row.content, 'utf8'),
      content: row.content,
    };
  }

  async countForRoom(roomId: string): Promise<number> {
    return this.prisma.snapshot.count({ where: { roomId } });
  }

  async deleteOldest(roomId: string, keep: number): Promise<number> {
    // Find ids beyond the `keep` newest, delete them.
    const newest = await this.prisma.snapshot.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: keep,
      select: { id: true },
    });
    const keepIds = new Set(newest.map((r) => r.id));
    const stale = await this.prisma.snapshot.findMany({
      where: { roomId, id: { notIn: [...keepIds] } },
      select: { id: true },
    });
    if (stale.length === 0) return 0;
    const result = await this.prisma.snapshot.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
    return result.count;
  }
}
