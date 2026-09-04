import type { PrismaClient, Room as PrismaRoom, RoomVisibility as PrismaVisibility } from '@prisma/client';
import {
  DEFAULT_ROOM_VISIBILITY,
  SUPPORTED_LANGUAGES,
  type RoomVisibility,
  type SupportedLanguage,
} from '@/constants/index.js';
import type { RoomRepository } from '@/rooms/roomRepository.js';
import type { Room } from '@/rooms/types.js';

function toLanguage(value: string): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    ? (value as SupportedLanguage)
    : 'javascript';
}

const TO_API: Record<PrismaVisibility, RoomVisibility> = {
  private: 'private',
  link_edit: 'link-edit',
  link_view: 'link-view',
};

const TO_PRISMA: Record<RoomVisibility, PrismaVisibility> = {
  private: 'private',
  'link-edit': 'link_edit',
  'link-view': 'link_view',
};

function fromPrisma(row: PrismaRoom): Room {
  return {
    id: row.id,
    name: row.name,
    language: toLanguage(row.language),
    visibility: TO_API[row.visibility] ?? DEFAULT_ROOM_VISIBILITY,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(room: Room): Promise<Room> {
    const created = await this.prisma.room.create({
      data: {
        id: room.id,
        name: room.name,
        language: room.language,
        visibility: TO_PRISMA[room.visibility],
        ownerId: room.ownerId,
      },
    });
    return fromPrisma(created);
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { id } });
    return row ? fromPrisma(row) : null;
  }

  async list(filter: { userId?: string; ownerId?: string } = {}): Promise<Room[]> {
    const where = filter.userId
      ? {
          OR: [{ ownerId: filter.userId }, { members: { some: { userId: filter.userId } } }],
        }
      : filter.ownerId
        ? { ownerId: filter.ownerId }
        : undefined;
    const rows = await this.prisma.room.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(fromPrisma);
  }

  async update(
    id: string,
    patch: Partial<Pick<Room, 'name' | 'language' | 'visibility'>>,
  ): Promise<Room | null> {
    try {
      const updated = await this.prisma.room.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.language !== undefined ? { language: patch.language } : {}),
          ...(patch.visibility !== undefined ? { visibility: TO_PRISMA[patch.visibility] } : {}),
        },
      });
      return fromPrisma(updated);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.room.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
