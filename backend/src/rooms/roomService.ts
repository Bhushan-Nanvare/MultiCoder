import { nanoid } from 'nanoid';
import {
  DEFAULT_ROOM_LANGUAGE,
  ROOM_ID_LENGTH,
  type SupportedLanguage,
} from '@/constants/index.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import type { RoomRepository } from '@/rooms/roomRepository.js';
import type { CreateRoomInput, Room } from '@/rooms/types.js';
import { NotFoundError } from '@/utils/errors.js';

export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly documents: RealtimeDocumentService,
  ) {}

  async create(input: CreateRoomInput): Promise<Room> {
    const id = nanoid(ROOM_ID_LENGTH);
    const now = new Date().toISOString();
    const language: SupportedLanguage = input.language ?? DEFAULT_ROOM_LANGUAGE;
    const room: Room = {
      id,
      name: input.name?.trim() || `Untitled room ${id}`,
      language,
      ownerId: input.ownerId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.repository.create(room);
    await this.documents.initializeDocument(id, language);
    return created;
  }

  async list(filter: { ownerId?: string } = {}): Promise<Room[]> {
    return this.repository.list(filter);
  }

  async get(id: string): Promise<Room> {
    const room = await this.repository.findById(id);
    if (!room) throw new NotFoundError(`Room ${id} not found`);
    return room;
  }
}
