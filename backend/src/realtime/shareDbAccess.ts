import type ShareDB from 'sharedb';
import { SHAREDB_COLLECTION } from '@/constants/index.js';
import type { RoomService } from '@/rooms/roomService.js';
import { logger } from '@/utils/logger.js';

export interface ShareDbClientContext {
  userId: string | null;
}

function isServerAgent(agent: { stream?: { isServer?: boolean } }): boolean {
  return agent.stream?.isServer === true;
}

function deny(callback: (err?: unknown) => void, message: string): void {
  const err = new Error(message) as Error & { code: string };
  err.code = 'FORBIDDEN';
  callback(err);
}

/**
 * Enforces room visibility on ShareDB subscribe/fetch (read) and submit (edit).
 * In-process `backend.connect()` agents are skipped (stream.isServer).
 * Anonymous clients may read only `link-view` rooms.
 */
export function installRoomAccessMiddleware(backend: ShareDB, roomService: RoomService): void {
  const authorizeRead = (
    collection: string,
    id: string,
    agent: { custom?: ShareDbClientContext; stream?: { isServer?: boolean } },
    callback: (err?: unknown) => void,
  ): void => {
    if (collection !== SHAREDB_COLLECTION) {
      deny(callback, 'Unknown collection');
      return;
    }
    if (isServerAgent(agent)) {
      callback();
      return;
    }
    const userId = agent.custom?.userId ?? null;
    roomService
      .userCanRead(id, userId)
      .then((ok) => {
        if (!ok) {
          deny(callback, 'You do not have access to this room');
          return;
        }
        callback();
      })
      .catch((err: unknown) => {
        logger.debug({ err, roomId: id }, 'ShareDB read denied');
        deny(callback, 'Room not found');
      });
  };

  backend.use('connect', (context, next) => {
    const req = context.req as ShareDbClientContext | undefined;
    if (req && typeof req === 'object') {
      context.agent.custom = { userId: req.userId ?? null } satisfies ShareDbClientContext;
    } else if (!context.agent.custom) {
      context.agent.custom = { userId: null } satisfies ShareDbClientContext;
    }
    next();
  });

  backend.use('readSnapshots', (context, next) => {
    if (context.collection !== SHAREDB_COLLECTION) {
      deny(next, 'Unknown collection');
      return;
    }
    if (isServerAgent(context.agent)) {
      next();
      return;
    }
    const snapshots = context.snapshots ?? [];
    if (snapshots.length === 0) {
      next();
      return;
    }
    Promise.all(
      snapshots.map(
        (snapshot) =>
          new Promise<void>((resolve, reject) => {
            authorizeRead(context.collection, snapshot.id, context.agent, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }),
      ),
    )
      .then(() => next())
      .catch((err) => next(err));
  });

  backend.use('submit', (context, next) => {
    if (context.collection !== SHAREDB_COLLECTION) {
      deny(next, 'Unknown collection');
      return;
    }
    if (isServerAgent(context.agent)) {
      next();
      return;
    }
    const userId = (context.agent.custom as ShareDbClientContext | undefined)?.userId ?? null;
    roomService
      .userCanEdit(context.id, userId)
      .then((ok) => {
        if (!ok) {
          deny(next, 'This room is read-only');
          return;
        }
        next();
      })
      .catch((err: unknown) => {
        logger.debug({ err, roomId: context.id }, 'ShareDB submit denied');
        deny(next, 'Room not found');
      });
  });
}
