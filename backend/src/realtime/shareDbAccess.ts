import type ShareDB from 'sharedb';
import { ROOM_PRESENCE_CHANNEL_PREFIX, SHAREDB_COLLECTION } from '@/constants/index.js';
import { assertValidLiveDocument } from '@/realtime/documentHelpers.js';
import type { RoomService } from '@/rooms/roomService.js';
import { logger } from '@/utils/logger.js';

/** Identity attached to a WebSocket connection at upgrade time. */
export interface ShareDbClientContext {
  userId: string | null;
  username: string | null;
}

/** Per-connection state kept on `agent.custom`. */
interface AgentState extends ShareDbClientContext {
  /** Room read-access results for presence channels, cached per connection. */
  presenceAccess: Map<string, Promise<boolean>>;
}

type AgentLike = { custom?: unknown; stream?: { isServer?: boolean } };
type Callback = (err?: unknown) => void;

// ShareDB wire protocol action codes (sharedb/lib/message-actions.js).
const PRESENCE_SUBSCRIBE_ACTION = 'ps';
const PRESENCE_REQUEST_ACTION = 'pr';

// Clients treat this code as an intentional rejection and roll the op back
// instead of surfacing a hard error.
const OP_REJECTED_CODE = 'ERR_OP_SUBMIT_REJECTED';

function isServerAgent(agent: AgentLike): boolean {
  return agent.stream?.isServer === true;
}

function agentState(agent: AgentLike): AgentState {
  const custom = agent.custom as Partial<AgentState> | undefined;
  if (custom?.presenceAccess) return custom as AgentState;
  const state: AgentState = {
    userId: custom?.userId ?? null,
    username: custom?.username ?? null,
    presenceAccess: new Map(),
  };
  agent.custom = state;
  return state;
}

function deny(callback: Callback, message: string, code = 'FORBIDDEN'): void {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  callback(err);
}

function roomIdFromPresenceChannel(channel: unknown): string | null {
  if (typeof channel !== 'string' || !channel.startsWith(ROOM_PRESENCE_CHANNEL_PREFIX)) {
    return null;
  }
  const roomId = channel.slice(ROOM_PRESENCE_CHANNEL_PREFIX.length);
  return roomId.length > 0 ? roomId : null;
}

function editsMeta(components: unknown): boolean {
  return (
    Array.isArray(components) &&
    components.some((component) => {
      const path = (component as { p?: unknown } | null)?.p;
      return Array.isArray(path) && path[0] === 'meta';
    })
  );
}

/**
 * Enforces room access on ShareDB:
 * - subscribe/fetch (read) and submit (edit) follow room visibility;
 * - every client op must leave the document valid (commit);
 * - queries are refused, since rooms are only ever opened by id;
 * - presence channels need read access, and presence payloads must carry the
 *   sender's real identity.
 * In-process `backend.connect()` agents are skipped (stream.isServer).
 * Anonymous clients may read only `link-view` rooms.
 */
export function installRoomAccessMiddleware(backend: ShareDB, roomService: RoomService): void {
  const authorizeRead = (
    collection: string,
    id: string,
    agent: AgentLike,
    callback: Callback,
  ): void => {
    if (collection !== SHAREDB_COLLECTION) {
      deny(callback, 'Unknown collection');
      return;
    }
    if (isServerAgent(agent)) {
      callback();
      return;
    }
    const { userId } = agentState(agent);
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

  const checkPresenceAccess = (state: AgentState, channel: string): Promise<boolean> => {
    const cached = state.presenceAccess.get(channel);
    if (cached) return cached;
    const roomId = roomIdFromPresenceChannel(channel);
    const check = roomId ? roomService.userCanRead(roomId, state.userId) : Promise.resolve(false);
    state.presenceAccess.set(channel, check);
    return check;
  };

  backend.use('connect', (context, next) => {
    const req = context.req as Partial<ShareDbClientContext> | undefined;
    const state: AgentState = {
      userId: req?.userId ?? null,
      username: req?.username ?? null,
      presenceAccess: new Map(),
    };
    context.agent.custom = state;
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
    const { userId } = agentState(context.agent);
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

  // Runs after the op is applied and before it is saved, so it sees the result.
  // Without it, anyone who can edit could delete `files`, blow past the size
  // limits, or credit their run output to someone else.
  backend.use('commit', (context, next) => {
    if (isServerAgent(context.agent)) {
      next();
      return;
    }
    const op = context.op as { create?: unknown; del?: unknown; op?: unknown };
    if (op.create !== undefined || op.del !== undefined) {
      deny(next, 'Clients cannot create or delete room documents', OP_REJECTED_CODE);
      return;
    }
    try {
      const doc = assertValidLiveDocument(context.snapshot?.data);
      const lastRun = doc.meta?.lastRun;
      const { userId, username } = agentState(context.agent);
      if (
        lastRun &&
        editsMeta(op.op) &&
        (lastRun.triggeredBy !== userId || lastRun.triggeredByUsername !== username)
      ) {
        deny(next, 'Run output must be attributed to the submitting user', OP_REJECTED_CODE);
        return;
      }
      next();
    } catch (err) {
      logger.debug({ err, roomId: context.id }, 'Rejected invalid ShareDB op');
      deny(next, err instanceof Error ? err.message : 'Invalid document change', OP_REJECTED_CODE);
    }
  });

  backend.use('query', (context, next) => {
    if (isServerAgent(context.agent)) {
      next();
      return;
    }
    deny(next, 'Queries are not supported');
  });

  // Presence travels on channels, which the document middleware above never
  // sees. Subscribing requires read access to the room.
  backend.use('receive', (context, next) => {
    const message = context.data;
    const isPresenceSubscription =
      message.a === PRESENCE_SUBSCRIBE_ACTION || message.a === PRESENCE_REQUEST_ACTION;
    if (!isPresenceSubscription || isServerAgent(context.agent)) {
      next();
      return;
    }
    if (!roomIdFromPresenceChannel(message.ch)) {
      deny(next, 'Unknown presence channel');
      return;
    }
    void checkPresenceAccess(agentState(context.agent), message.ch as string).then((ok) => {
      if (ok) next();
      else deny(next, 'You do not have access to this room');
    });
  });

  backend.use('receivePresence', (context, next) => {
    if (isServerAgent(context.agent)) {
      next();
      return;
    }
    const { presence } = context;
    if (!roomIdFromPresenceChannel(presence.ch)) {
      deny(next, 'Unknown presence channel');
      return;
    }
    const state = agentState(context.agent);
    void checkPresenceAccess(state, presence.ch).then((ok) => {
      if (!ok) {
        deny(next, 'You do not have access to this room');
        return;
      }
      // null = the sender is leaving; always allowed.
      if (presence.p === null || presence.p === undefined) {
        next();
        return;
      }
      const value = presence.p as { userId?: unknown; username?: unknown };
      if (
        !state.userId ||
        typeof value !== 'object' ||
        value.userId !== state.userId ||
        value.username !== state.username
      ) {
        deny(next, 'Presence must match your signed-in identity');
        return;
      }
      next();
    });
  });
}
