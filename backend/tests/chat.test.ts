import { createRequire } from 'node:module';
import ShareDB from 'sharedb';
import { Connection } from 'sharedb/lib/client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHAT_COLLECTION,
  CHAT_MAX_MESSAGES,
  CHAT_MAX_MESSAGE_LENGTH,
  SHAREDB_COLLECTION,
} from '@/constants/index.js';
import {
  assertValidChatDocument,
  createEmptyChatDocument,
  type ChatMessage,
} from '@/realtime/chatDocument.js';
import { installRoomAccessMiddleware } from '@/realtime/shareDbAccess.js';
import type { RoomService } from '@/rooms/roomService.js';

// sharedb/lib/stream-socket ships no types, and it is the only way to drive the
// middleware as a remote (non-server) client in-process.
const require_ = createRequire(import.meta.url);
const StreamSocket = require_('sharedb/lib/stream-socket') as new () => {
  stream: { isServer: boolean };
  _open(): void;
};

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  userId: 'owner',
  username: 'owner',
  text: 'hello',
  at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('assertValidChatDocument', () => {
  it('accepts a fresh document', () => {
    expect(() => assertValidChatDocument(createEmptyChatDocument())).not.toThrow();
  });

  it('accepts a document holding messages', () => {
    expect(() => assertValidChatDocument({ version: 1, messages: [message()] })).not.toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() => assertValidChatDocument({ version: 1, messages: [], pinned: true })).toThrow(
      /Unexpected/,
    );
  });

  it('rejects an unsupported version', () => {
    expect(() => assertValidChatDocument({ version: 2, messages: [] })).toThrow(/version/);
  });

  it('rejects a malformed message', () => {
    expect(() => assertValidChatDocument({ version: 1, messages: [{ text: 'hi' }] })).toThrow(
      /malformed/,
    );
  });

  it('rejects a message carrying extra fields', () => {
    expect(() =>
      assertValidChatDocument({ version: 1, messages: [{ ...message(), isAdmin: true }] }),
    ).toThrow(/malformed/);
  });

  it('rejects empty text', () => {
    expect(() => assertValidChatDocument({ version: 1, messages: [message({ text: '   ' })] })).toThrow(
      /empty/,
    );
  });

  it('rejects text over the length limit', () => {
    const text = 'x'.repeat(CHAT_MAX_MESSAGE_LENGTH + 1);
    expect(() => assertValidChatDocument({ version: 1, messages: [message({ text })] })).toThrow(
      /characters/,
    );
  });

  it('rejects more messages than the cap', () => {
    const messages = Array.from({ length: CHAT_MAX_MESSAGES + 1 }, (_, index) =>
      message({ id: `m${index}` }),
    );
    expect(() => assertValidChatDocument({ version: 1, messages })).toThrow(/messages/);
  });
});

describe('chat access control', () => {
  const rooms: Record<string, { visibility: string; ownerId: string }> = {
    open: { visibility: 'link-edit', ownerId: 'owner' },
    secret: { visibility: 'private', ownerId: 'owner' },
  };

  const roomService = {
    async userCanRead(id: string, userId: string | null) {
      const room = rooms[id];
      if (!room) return false;
      return room.visibility !== 'private' || userId === room.ownerId;
    },
    async userCanEdit(id: string, userId: string | null) {
      const room = rooms[id];
      if (!room || !userId) return false;
      return room.visibility === 'link-edit' || userId === room.ownerId;
    },
  } as unknown as RoomService;

  let backend: ShareDB;

  const remoteClient = (userId: string | null, username: string | null): Connection => {
    const socket = new StreamSocket();
    socket.stream.isServer = false;
    const connection = new Connection(socket as never);
    socket._open();
    backend.listen(socket.stream as never, { userId, username });
    return connection;
  };

  const submit = (connection: Connection, roomId: string, ops: unknown[]): Promise<unknown> =>
    new Promise((resolve) => {
      const doc = connection.get(CHAT_COLLECTION, roomId);
      doc.submitOp(ops as never, undefined, (err) => resolve(err ?? null));
    });

  const subscribe = (connection: Connection, collection: string, id: string): Promise<unknown> =>
    new Promise((resolve) => {
      connection.get(collection, id).subscribe((err) => resolve(err ?? null));
    });

  // Ops rejected with ERR_OP_SUBMIT_REJECTED roll back silently on the client,
  // so stored state is what proves the rule held.
  const storedMessages = async (roomId: string): Promise<ChatMessage[]> => {
    const doc = backend.connect().get(CHAT_COLLECTION, roomId);
    await new Promise<void>((resolve, reject) => {
      doc.fetch((err) => (err ? reject(err) : resolve()));
    });
    return (doc.data as { messages: ChatMessage[] }).messages;
  };

  beforeEach(async () => {
    backend = new ShareDB({ presence: true, doNotForwardSendPresenceErrorsToClient: true });
    installRoomAccessMiddleware(backend, roomService);

    const server = backend.connect();
    await new Promise<void>((resolve, reject) => {
      server
        .get(CHAT_COLLECTION, 'open')
        .create(createEmptyChatDocument(), (err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      server
        .get(CHAT_COLLECTION, 'secret')
        .create(createEmptyChatDocument(), (err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      server.get(SHAREDB_COLLECTION, 'open').create(
        { version: 2, entryPoint: 'main.js', files: { 'main.js': { content: '' } } },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  });

  it('lets a signed-in reader post', async () => {
    const alice = remoteClient('alice', 'alice');
    expect(await subscribe(alice, CHAT_COLLECTION, 'open')).toBeNull();
    const err = await submit(alice, 'open', [
      { p: ['messages', 0], li: message({ userId: 'alice', username: 'alice' }) },
    ]);
    expect(err).toBeNull();
  });

  it('refuses a message attributed to someone else', async () => {
    const alice = remoteClient('alice', 'alice');
    await subscribe(alice, CHAT_COLLECTION, 'open');
    await submit(alice, 'open', [
      { p: ['messages', 0], li: message({ userId: 'bob', username: 'bob' }) },
    ]);
    expect(await storedMessages('open')).toHaveLength(0);
  });

  it('refuses an oversized message', async () => {
    const alice = remoteClient('alice', 'alice');
    await subscribe(alice, CHAT_COLLECTION, 'open');
    await submit(alice, 'open', [
      {
        p: ['messages', 0],
        li: message({
          userId: 'alice',
          username: 'alice',
          text: 'x'.repeat(CHAT_MAX_MESSAGE_LENGTH + 1),
        }),
      },
    ]);
    expect(await storedMessages('open')).toHaveLength(0);
  });

  it('lets anonymous visitors read but not post', async () => {
    const guest = remoteClient(null, null);
    expect(await subscribe(guest, CHAT_COLLECTION, 'open')).toBeNull();
    const err = await submit(guest, 'open', [
      { p: ['messages', 0], li: message({ userId: '', username: '' }) },
    ]);
    expect(err).not.toBeNull();
  });

  it('keeps chat in a private room away from non-members', async () => {
    const stranger = remoteClient('stranger', 'stranger');
    expect(await subscribe(stranger, CHAT_COLLECTION, 'secret')).not.toBeNull();
  });

  it('does not apply project validation to chat documents', async () => {
    const alice = remoteClient('alice', 'alice');
    await subscribe(alice, CHAT_COLLECTION, 'open');
    await submit(alice, 'open', [
      { p: ['messages', 0], li: message({ userId: 'alice', username: 'alice' }) },
    ]);
    expect(await storedMessages('open')).toHaveLength(1);
  });
});
