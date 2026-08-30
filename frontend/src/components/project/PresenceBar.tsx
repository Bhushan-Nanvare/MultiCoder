import type { CSSProperties } from 'react';
import type { AuthUser } from '@/types/auth';
import type { RoomPresencePeer } from '@/realtime/presenceTypes';

interface PresenceBarProps {
  local: AuthUser;
  peers: RoomPresencePeer[];
}

export function PresenceBar({ local, peers }: PresenceBarProps): JSX.Element {
  const localName = local.displayName || local.username;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginLeft: 0,
        marginRight: 4,
      }}
      aria-label="People in this room"
    >
      <Avatar
        name={localName}
        avatarUrl={local.avatarUrl}
        title={`${localName} (you)`}
        ring="#64748b"
      />
      {peers.map((peer) => (
        <Avatar
          key={peer.presenceId}
          name={peer.displayName}
          avatarUrl={peer.avatarUrl}
          title={`${peer.displayName}${peer.activeFile ? ` · ${peer.activeFile}` : ''}`}
          ring={peer.color}
        />
      ))}
      <span style={{ fontSize: 12, opacity: 0.6, whiteSpace: 'nowrap' }}>
        {1 + peers.length === 1 ? 'Just you' : `${1 + peers.length} online`}
      </span>
    </div>
  );
}

interface AvatarProps {
  name: string;
  avatarUrl: string | null;
  title: string;
  ring: string;
}

function Avatar({ name, avatarUrl, title, ring }: AvatarProps): JSX.Element {
  const initials = name.trim().slice(0, 1).toUpperCase() || '?';
  const style: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: `2px solid ${ring}`,
    background: '#1e293b',
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  };

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={title} title={title} style={{ ...style, objectFit: 'cover' }} />
    );
  }

  return (
    <span title={title} style={style}>
      {initials}
    </span>
  );
}
