import type { PrismaClient, Room as PrismaRoom } from '@prisma/client';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/constants/index.js';
import type { RoomRepository } from '@/rooms/roomRepository.js';
import type { Room } from '@/rooms/types.js';

function toLanguage(value: string): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    ? (value as SupportedLanguage)
    : 'javascript';
}

function fromPrisma(row: PrismaRoom): Room {
  return {
    id: row.id,
    name: row.name,
    language: toLanguage(row.language),
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
        ownerId: room.ownerId,
      },
    });
    return fromPrisma(created);
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { id } });
    return row ? fromPrisma(row) : null;
  }

  async list(filter: { ownerId?: string } = {}): Promise<Room[]> {
    const rows = await this.prisma.room.findMany({
      where: filter.ownerId ? { ownerId: filter.ownerId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(fromPrisma);
  }

  async update(
    id: string,
    patch: Partial<Pick<Room, 'name' | 'language'>>,
  ): Promise<Room | null> {
    try {
      const updated = await this.prisma.room.update({
        where: { id },
        data: patch,
      });
      return fromPrisma(updated);
    } catch {
      return null;
    }
  }
}
