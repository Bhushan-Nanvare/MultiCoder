import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@/types/auth';
import {
  colorForUserId,
  parseRoomPresenceValue,
  type PresenceCursor,
  type PresenceSelection,
  type RoomPresencePeer,
  type RoomPresenceValue,
} from '@/realtime/presenceTypes';
import {
  getRoomPresenceChannel,
  type RoomLocalPresence,
} from '@/realtime/shareDbPresence';

const CURSOR_DEBOUNCE_MS = 80;

interface UseRoomPresenceOptions {
  roomId: string;
  user: AuthUser | null;
  activeFile: string;
  enabled: boolean;
}

export function useRoomPresence({
  roomId,
  user,
  activeFile,
  enabled,
}: UseRoomPresenceOptions): {
  peers: RoomPresencePeer[];
  updateCursor: (cursor: PresenceCursor | null, selection: PresenceSelection | null) => void;
} {
  const [peers, setPeers] = useState<RoomPresencePeer[]>([]);
  const localRef = useRef<RoomLocalPresence | null>(null);
  const cursorRef = useRef<PresenceCursor | null>(null);
  const selectionRef = useRef<PresenceSelection | null>(null);
  const userRef = useRef(user);
  const activeFileRef = useRef(activeFile);
  userRef.current = user;
  activeFileRef.current = activeFile;

  const submitNow = useCallback((): void => {
    const local = localRef.current;
    const currentUser = userRef.current;
    if (!local || !currentUser) return;
    const payload: RoomPresenceValue = {
      userId: currentUser.id,
      displayName: currentUser.displayName || currentUser.username,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl,
      activeFile: activeFileRef.current,
      cursor: cursorRef.current,
      selection: selectionRef.current,
    };
    local.submit(payload);
  }, []);

  useEffect(() => {
    if (!enabled || !roomId || !user) {
      setPeers([]);
      return undefined;
    }

    let cancelled = false;
    const presence = getRoomPresenceChannel(roomId);
    const remoteValues = new Map<string, RoomPresenceValue>();

    const syncPeers = (): void => {
      const next: RoomPresencePeer[] = [];
      for (const [presenceId, value] of remoteValues) {
        next.push({
          ...value,
          presenceId,
          color: colorForUserId(value.userId),
        });
      }
      next.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setPeers(next);
    };

    const onReceive = (presenceId: string, raw: unknown): void => {
      if (cancelled) return;
      if (raw === null || raw === undefined) {
        remoteValues.delete(presenceId);
        syncPeers();
        return;
      }
      const parsed = parseRoomPresenceValue(raw);
      if (!parsed) return;
      remoteValues.set(presenceId, parsed);
      syncPeers();
    };

    presence.on('receive', onReceive);
    presence.subscribe((subscribeError?: { message?: string }) => {
      if (cancelled) return;
      if (subscribeError) {
        setPeers([]);
        return;
      }
      const local = presence.create();
      localRef.current = local;
      submitNow();
    });

    return () => {
      cancelled = true;
      presence.removeListener('receive', onReceive);
      const local = localRef.current;
      localRef.current = null;
      if (local) {
        local.destroy();
      }
      presence.unsubscribe();
      setPeers([]);
    };
  }, [enabled, roomId, user?.id, submitNow]);

  useEffect(() => {
    submitNow();
  }, [activeFile, submitNow]);

  const debounceRef = useRef<number | null>(null);
  const updateCursor = useCallback(
    (cursor: PresenceCursor | null, selection: PresenceSelection | null): void => {
      cursorRef.current = cursor;
      selectionRef.current = selection;
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        submitNow();
      }, CURSOR_DEBOUNCE_MS);
    },
    [submitNow],
  );

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  return { peers, updateCursor };
}
