import type { RoomVisibility } from '@/constants/index.js';
import type { Room } from '@/rooms/types.js';
import { ForbiddenError } from '@/utils/errors.js';

export interface RoomActor {
  userId: string | null;
  /** Owner or invited editor. */
  isEditor: boolean;
}

export interface RoomAccessView {
  canEdit: boolean;
  isOwner: boolean;
  isEditor: boolean;
  canDelete: boolean;
  canUseAiReview: boolean;
  canUsePlagiarism: boolean;
}

export function canReadRoom(room: Pick<Room, 'visibility' | 'ownerId'>, actor: RoomActor): boolean {
  if (room.visibility === 'private') {
    return actor.isEditor;
  }
  return true;
}

export function canEditRoom(room: Pick<Room, 'visibility'>, actor: RoomActor): boolean {
  if (!actor.userId) return false;
  if (room.visibility === 'link-edit') return true;
  return actor.isEditor;
}

export function assertCanReadRoom(room: Pick<Room, 'visibility' | 'ownerId'>, actor: RoomActor): void {
  if (!canReadRoom(room, actor)) {
    throw new ForbiddenError('You do not have access to this room');
  }
}

export function assertCanEditRoom(room: Pick<Room, 'visibility'>, actor: RoomActor): void {
  if (!canEditRoom(room, actor)) {
    throw new ForbiddenError('This room is read-only');
  }
}

export function isOwner(room: Pick<Room, 'ownerId'>, userId: string | null): boolean {
  return userId !== null && room.ownerId === userId;
}

/**
 * In a collaborate room AI review is a helper, so anyone who can open the room
 * may use it. In an assessment room it belongs to the examiner — the candidate
 * must not get AI help on the work being judged.
 */
export function canUseAiReview(
  room: Pick<Room, 'mode' | 'visibility' | 'ownerId'>,
  actor: RoomActor,
): boolean {
  if (!actor.userId) return false;
  if (room.mode === 'assessment') return isOwner(room, actor.userId);
  return canReadRoom(room, actor);
}

/** Plagiarism comparison exists only in assessment rooms, and only for the owner. */
export function canUsePlagiarism(
  room: Pick<Room, 'mode' | 'ownerId'>,
  actor: RoomActor,
): boolean {
  if (!actor.userId) return false;
  return room.mode === 'assessment' && isOwner(room, actor.userId);
}

export function withAccess(room: Room, actor: RoomActor): Room & RoomAccessView {
  const owner = isOwner(room, actor.userId);
  return {
    ...room,
    canEdit: canEditRoom(room, actor),
    isOwner: owner,
    isEditor: actor.isEditor,
    canDelete: owner,
    canUseAiReview: canUseAiReview(room, actor),
    canUsePlagiarism: canUsePlagiarism(room, actor),
  };
}

export const VISIBILITY_LABELS: Record<RoomVisibility, string> = {
  private: 'Only you and invited editors',
  'link-edit': 'Anyone with the link can edit',
  'link-view': 'Anyone with the link can view',
};
