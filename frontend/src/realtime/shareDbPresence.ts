import { getShareDbConnection } from '@/realtime/sharedbConnection';
import type { Connection } from 'sharedb/lib/client';

export type RoomChannelPresence = ReturnType<Connection['getPresence']>;
export type RoomLocalPresence = ReturnType<RoomChannelPresence['create']>;

/**
 * Channel presence (not doc presence). json0 cannot transform cursor indexes,
 * so we publish a custom payload on a room-scoped channel instead.
 */
export function getRoomPresenceChannel(roomId: string): RoomChannelPresence {
  return getShareDbConnection().getPresence(`room-presence:${roomId}`);
}
