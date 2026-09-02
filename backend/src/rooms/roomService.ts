import { nanoid } from 'nanoid';
import {
  DEFAULT_ROOM_LANGUAGE,
  DEFAULT_ROOM_VISIBILITY,
  ROOM_ID_LENGTH,
  type RoomVisibility,
  type SupportedLanguage,
} from '@/constants/index.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import { assertCanEditRoom, canReadRoom, isOwner } from '@/rooms/access.js';
import type { RoomRepository } from '@/rooms/roomRepository.js';
import type { CreateRoomInput, Room } from '@/rooms/types.js';
import { projectDocumentForNewRoom } from '@/projects/templates/index.js';
import { ForbiddenError, NotFoundError } from '@/utils/errors.js';

export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly documents: RealtimeDocumentService,
  ) {}

  async create(input: CreateRoomInput): Promise<Room> {
    const id = nanoid(ROOM_ID_LENGTH);
    const now = new Date().toISOString();
    const seeded = projectDocumentForNewRoom(input.language ?? DEFAULT_ROOM_LANGUAGE, input.templateId);
    const language: SupportedLanguage = seeded.language;
    const room: Room = {
      id,
      name: input.name?.trim() || `Untitled room ${id}`,
      language,
      visibility: input.visibility ?? DEFAULT_ROOM_VISIBILITY,
      ownerId: input.ownerId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.repository.create(room);
    await this.documents.initializeDocument(id, language, seeded.document);
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

  async getReadable(id: string, userId: string | null): Promise<Room> {
    const room = await this.get(id);
    if (!canReadRoom(room, userId)) {
      throw new NotFoundError(`Room ${id} not found`);
    }
    return room;
  }

  async getEditable(id: string, userId: string | null): Promise<Room> {
    const room = await this.get(id);
    assertCanEditRoom(room, userId);
    return room;
  }

  async updateVisibility(id: string, userId: string, visibility: RoomVisibility): Promise<Room> {
    const room = await this.get(id);
    if (!isOwner(room, userId)) {
      throw new ForbiddenError('Only the room owner can change visibility');
    }
    const updated = await this.repository.update(id, { visibility });
    if (!updated) throw new NotFoundError(`Room ${id} not found`);
    return updated;
  }
}
