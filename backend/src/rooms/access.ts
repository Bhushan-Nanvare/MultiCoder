import type { RoomVisibility } from '@/constants/index.js';
import type { Room } from '@/rooms/types.js';
import { ForbiddenError } from '@/utils/errors.js';

export function canReadRoom(room: Pick<Room, 'visibility' | 'ownerId'>, userId: string | null): boolean {
  if (room.visibility === 'private') {
    return userId !== null && userId === room.ownerId;
  }
  return true;
}

export function canEditRoom(room: Pick<Room, 'visibility' | 'ownerId'>, userId: string | null): boolean {
  if (!userId) return false;
  if (room.visibility === 'link-edit') return true;
  return userId === room.ownerId;
}

export function assertCanReadRoom(room: Pick<Room, 'visibility' | 'ownerId'>, userId: string | null): void {
  if (!canReadRoom(room, userId)) {
    throw new ForbiddenError('You do not have access to this room');
  }
}

export function assertCanEditRoom(room: Pick<Room, 'visibility' | 'ownerId'>, userId: string | null): void {
  if (!canEditRoom(room, userId)) {
    throw new ForbiddenError('This room is read-only');
  }
}

export function isOwner(room: Pick<Room, 'ownerId'>, userId: string | null): boolean {
  return userId !== null && room.ownerId === userId;
}

export function withAccess(
  room: Room,
  userId: string | null,
): Room & { canEdit: boolean; isOwner: boolean } {
  return {
    ...room,
    canEdit: canEditRoom(room, userId),
    isOwner: isOwner(room, userId),
  };
}

export const VISIBILITY_LABELS: Record<RoomVisibility, string> = {
  private: 'Only you',
  'link-edit': 'Anyone with the link can edit',
  'link-view': 'Anyone with the link can view',
};
