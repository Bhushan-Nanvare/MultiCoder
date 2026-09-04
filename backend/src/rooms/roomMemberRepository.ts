import type { PrismaClient } from '@prisma/client';
import type { RoomMemberView } from '@/rooms/types.js';

export interface RoomMemberRepository {
  isMember(roomId: string, userId: string): Promise<boolean>;
  list(roomId: string): Promise<RoomMemberView[]>;
  add(roomId: string, userId: string): Promise<RoomMemberView>;
  remove(roomId: string, userId: string): Promise<boolean>;
}

export class PrismaRoomMemberRepository implements RoomMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const row = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    return row !== null;
  }

  async list(roomId: string): Promise<RoomMemberView[]> {
    const rows = await this.prisma.roomMember.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    return rows.map((row) => ({
      userId: row.userId,
      username: row.user.username,
      displayName: row.user.displayName,
      avatarUrl: row.user.avatarUrl,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async add(roomId: string, userId: string): Promise<RoomMemberView> {
    const row = await this.prisma.roomMember.create({
      data: { roomId, userId },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    return {
      userId: row.userId,
      username: row.user.username,
      displayName: row.user.displayName,
      avatarUrl: row.user.avatarUrl,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async remove(roomId: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.roomMember.delete({
        where: { roomId_userId: { roomId, userId } },
      });
      return true;
    } catch {
      return false;
    }
  }
}
