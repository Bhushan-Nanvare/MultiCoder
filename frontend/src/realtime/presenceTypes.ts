export interface PresenceCursor {
  line: number;
  column: number;
}

export interface PresenceSelection {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface RoomPresenceValue {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  activeFile: string;
  cursor: PresenceCursor | null;
  selection: PresenceSelection | null;
}

export interface RoomPresencePeer extends RoomPresenceValue {
  presenceId: string;
  color: string;
}

const PRESENCE_COLORS = [
  '#f97316',
  '#22c55e',
  '#38bdf8',
  '#e879f9',
  '#facc15',
  '#fb7185',
  '#a78bfa',
  '#2dd4bf',
] as const;

export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length] ?? PRESENCE_COLORS[0];
}

export function parseRoomPresenceValue(raw: unknown): RoomPresenceValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.userId !== 'string' || value.userId.length === 0) return null;
  if (typeof value.displayName !== 'string') return null;
  if (typeof value.username !== 'string') return null;
  if (typeof value.activeFile !== 'string') return null;
  if (value.avatarUrl !== null && typeof value.avatarUrl !== 'string') return null;

  return {
    userId: value.userId,
    displayName: value.displayName,
    username: value.username,
    avatarUrl: value.avatarUrl,
    activeFile: value.activeFile,
    cursor: parseCursor(value.cursor),
    selection: parseSelection(value.selection),
  };
}

function parseCursor(raw: unknown): PresenceCursor | null {
  if (!raw || typeof raw !== 'object') return null;
  const cursor = raw as Record<string, unknown>;
  if (!isPositiveInt(cursor.line) || !isPositiveInt(cursor.column)) return null;
  return { line: cursor.line, column: cursor.column };
}

function parseSelection(raw: unknown): PresenceSelection | null {
  if (!raw || typeof raw !== 'object') return null;
  const selection = raw as Record<string, unknown>;
  if (
    !isPositiveInt(selection.startLine) ||
    !isPositiveInt(selection.startColumn) ||
    !isPositiveInt(selection.endLine) ||
    !isPositiveInt(selection.endColumn)
  ) {
    return null;
  }
  return {
    startLine: selection.startLine,
    startColumn: selection.startColumn,
    endLine: selection.endLine,
    endColumn: selection.endColumn,
  };
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}
