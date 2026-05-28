import ReconnectingWebSocket from 'reconnecting-websocket';
import { Connection } from 'sharedb/lib/client';
import { env } from '@/config/env';

let cached: Connection | null = null;

/**
 * Returns a process-wide ShareDB Connection over a resilient WebSocket. The
 * single connection multiplexes every document subscription, matching ShareDB's
 * intended usage and avoiding duplicate socket overhead.
 */
export function getShareDbConnection(): Connection {
  if (cached) return cached;
  const socket = new ReconnectingWebSocket(env.wsUrl, [], {
    maxReconnectionDelay: 8_000,
    minReconnectionDelay: 500,
    reconnectionDelayGrowFactor: 1.5,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cached = new Connection(socket as any);
  return cached;
}

export const SHAREDB_COLLECTION = 'rooms';
