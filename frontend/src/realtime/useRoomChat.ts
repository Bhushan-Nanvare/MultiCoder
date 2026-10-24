import { useCallback, useEffect, useState } from 'react';
import type { Doc } from 'sharedb/lib/client';
import { getShareDbConnection } from '@/realtime/sharedbConnection';
import type { AuthUser } from '@/types/auth';
import {
  CHAT_COLLECTION,
  CHAT_MAX_MESSAGES,
  CHAT_MAX_MESSAGE_LENGTH,
  type ChatDocument,
  type ChatMessage,
} from '@/types/chat';

interface RoomChatState {
  status: 'connecting' | 'ready' | 'error';
  error: string | null;
  messages: ChatMessage[];
}

const initialState: RoomChatState = { status: 'connecting', error: null, messages: [] };

export function useRoomChat(
  roomId: string,
  user: AuthUser | null,
): RoomChatState & { send: (text: string) => Promise<void> } {
  const [state, setState] = useState<RoomChatState>(initialState);

  useEffect(() => {
    if (!roomId) return undefined;
    setState(initialState);

    const doc = getShareDbConnection().get(CHAT_COLLECTION, roomId) as Doc<ChatDocument>;

    const sync = (): void => {
      if (!doc.type || !doc.data) return;
      setState({ status: 'ready', error: null, messages: doc.data.messages ?? [] });
    };

    doc.subscribe((err) => {
      if (err) {
        setState((prev) => ({ ...prev, status: 'error', error: err.message }));
        return;
      }
      sync();
    });
    doc.on('op', sync);

    return () => {
      doc.off('op', sync);
      doc.unsubscribe(() => undefined);
    };
  }, [roomId]);

  const send = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || !user) return;
      if (trimmed.length > CHAT_MAX_MESSAGE_LENGTH) {
        throw new Error(`Messages are limited to ${CHAT_MAX_MESSAGE_LENGTH} characters`);
      }

      const doc = getShareDbConnection().get(CHAT_COLLECTION, roomId) as Doc<ChatDocument>;
      const messages = doc.data?.messages ?? [];
      const prune = messages.length >= CHAT_MAX_MESSAGES;
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        userId: user.id,
        username: user.username,
        text: trimmed,
        at: new Date().toISOString(),
      };

      const ops: unknown[] = [];
      if (prune) ops.push({ p: ['messages', 0], ld: messages[0] });
      ops.push({ p: ['messages', prune ? messages.length - 1 : messages.length], li: message });

      await new Promise<void>((resolve, reject) => {
        doc.submitOp(ops as never, undefined, (err) => (err ? reject(err) : resolve()));
      });
    },
    [roomId, user],
  );

  return { ...state, send };
}
