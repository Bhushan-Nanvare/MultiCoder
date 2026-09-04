import type { Room } from '@/rooms/types.js';

export interface RoomRepository {
  create(room: Room): Promise<Room>;
  findById(id: string): Promise<Room | null>;
  list(filter?: { userId?: string; ownerId?: string }): Promise<Room[]>;
  update(
    id: string,
    patch: Partial<Pick<Room, 'name' | 'language' | 'visibility'>>,
  ): Promise<Room | null>;
  delete(id: string): Promise<boolean>;
}
