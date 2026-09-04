import { nanoid } from 'nanoid';
import type { UserRepository } from '@/auth/userRepository.js';
import {
  DEFAULT_ROOM_LANGUAGE,
  DEFAULT_ROOM_VISIBILITY,
  ROOM_ID_LENGTH,
  type RoomVisibility,
  type SupportedLanguage,
} from '@/constants/index.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import {
  assertCanEditRoom,
  canEditRoom,
  canReadRoom,
  isOwner,
  withAccess,
  type RoomAccessView,
  type RoomActor,
} from '@/rooms/access.js';
import type { RoomMemberRepository } from '@/rooms/roomMemberRepository.js';
import type { RoomRepository } from '@/rooms/roomRepository.js';
import type { CreateRoomInput, Room, RoomMemberView } from '@/rooms/types.js';
import { projectDocumentForNewRoom } from '@/projects/templates/index.js';
import { ForbiddenError, NotFoundError, ValidationError } from '@/utils/errors.js';

export type PublicRoom = Room & RoomAccessView;

export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly documents: RealtimeDocumentService,
    private readonly members: RoomMemberRepository,
    private readonly users: UserRepository,
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

  async list(filter: { userId?: string; ownerId?: string } = {}): Promise<Room[]> {
    return this.repository.list(filter);
  }

  async get(id: string): Promise<Room> {
    const room = await this.repository.findById(id);
    if (!room) throw new NotFoundError(`Room ${id} not found`);
    return room;
  }

  async actorFor(room: Pick<Room, 'id' | 'ownerId'>, userId: string | null): Promise<RoomActor> {
    if (!userId) return { userId: null, isEditor: false };
    if (isOwner(room, userId)) return { userId, isEditor: true };
    const member = await this.members.isMember(room.id, userId);
    return { userId, isEditor: member };
  }

  async toPublic(room: Room, userId: string | null): Promise<PublicRoom> {
    const actor = await this.actorFor(room, userId);
    return withAccess(room, actor);
  }

  async getReadable(id: string, userId: string | null): Promise<Room> {
    const room = await this.get(id);
    const actor = await this.actorFor(room, userId);
    if (!canReadRoom(room, actor)) {
      throw new NotFoundError(`Room ${id} not found`);
    }
    return room;
  }

  async getEditable(id: string, userId: string | null): Promise<Room> {
    const room = await this.get(id);
    const actor = await this.actorFor(room, userId);
    assertCanEditRoom(room, actor);
    return room;
  }

  async userCanRead(roomId: string, userId: string | null): Promise<boolean> {
    try {
      const room = await this.get(roomId);
      const actor = await this.actorFor(room, userId);
      return canReadRoom(room, actor);
    } catch {
      return false;
    }
  }

  async userCanEdit(roomId: string, userId: string | null): Promise<boolean> {
    try {
      const room = await this.get(roomId);
      const actor = await this.actorFor(room, userId);
      return canEditRoom(room, actor);
    } catch {
      return false;
    }
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

  async deleteRoom(id: string, userId: string): Promise<void> {
    const room = await this.get(id);
    if (!isOwner(room, userId)) {
      throw new ForbiddenError('Only the room owner can delete this room');
    }
    await this.documents.destroyDocument(id);
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundError(`Room ${id} not found`);
  }

  async listMembers(id: string, userId: string): Promise<RoomMemberView[]> {
    const room = await this.getReadable(id, userId);
    if (!isOwner(room, userId) && !(await this.members.isMember(id, userId))) {
      throw new ForbiddenError('Only the owner and editors can list members');
    }
    return this.members.list(id);
  }

  async addMember(id: string, ownerId: string, username: string): Promise<RoomMemberView> {
    const room = await this.get(id);
    if (!isOwner(room, ownerId)) {
      throw new ForbiddenError('Only the room owner can invite editors');
    }
    const trimmed = username.trim().replace(/^@/, '');
    if (!trimmed) throw new ValidationError('Username is required');
    const user = await this.users.findByUsername(trimmed);
    if (!user) throw new NotFoundError(`No MultiCoder user named "${trimmed}"`);
    if (user.id === room.ownerId) {
      throw new ValidationError('The owner is already an editor');
    }
    if (await this.members.isMember(id, user.id)) {
      throw new ValidationError(`@${user.username} is already an editor`);
    }
    return this.members.add(id, user.id);
  }

  async removeMember(id: string, ownerId: string, memberUserId: string): Promise<void> {
    const room = await this.get(id);
    if (!isOwner(room, ownerId)) {
      throw new ForbiddenError('Only the room owner can remove editors');
    }
    const removed = await this.members.remove(id, memberUserId);
    if (!removed) throw new NotFoundError('Editor not found in this room');
  }
}
