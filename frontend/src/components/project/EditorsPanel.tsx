import { useState, type CSSProperties, type FormEvent } from 'react';
import type { RoomMember } from '@/types/room';

interface EditorsPanelProps {
  open: boolean;
  members: RoomMember[];
  loading: boolean;
  errorMessage: string | null;
  inviting: boolean;
  canManage: boolean;
  onInvite: (username: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onDismiss: () => void;
}

export function EditorsPanel({
  open,
  members,
  loading,
  errorMessage,
  inviting,
  canManage,
  onInvite,
  onRemove,
  onDismiss,
}: EditorsPanelProps): JSX.Element | null {
  const [username, setUsername] = useState('');

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = username.trim().replace(/^@/, '');
    if (!trimmed) return;
    await onInvite(trimmed);
    setUsername('');
  };

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: 360,
        background: '#0b1220',
        borderLeft: '1px solid #1f2937',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 21,
        boxShadow: '-12px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <strong>Editors</strong>
        <button type="button" onClick={onDismiss} style={dismissStyle} aria-label="Close editors">
          ×
        </button>
      </header>
      {canManage && (
      <form onSubmit={(event) => void handleSubmit(event)} style={{ display: 'grid', gap: 8, padding: '12px 18px', borderBottom: '1px solid #1f2937' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Invite by GitHub username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="octocat"
            maxLength={39}
            style={inputStyle}
          />
        </label>
        <button type="submit" disabled={inviting || username.trim().length === 0} style={inviteButtonStyle}>
          {inviting ? 'Inviting…' : 'Add editor'}
        </button>
        {errorMessage && <p style={{ color: '#f87171', margin: 0 }}>{errorMessage}</p>}
      </form>
      )}
      {!canManage && errorMessage && (
        <p style={{ color: '#f87171', margin: 0, padding: '12px 18px' }}>{errorMessage}</p>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px' }}>
        {loading && <p style={{ opacity: 0.7 }}>Loading…</p>}
        {!loading && members.length === 0 && (
          <p style={{ opacity: 0.55 }}>No invited editors yet. They can edit private and view-only rooms.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {members.map((member) => (
            <li key={member.userId} style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600 }}>{member.displayName}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>@{member.username}</div>
              </div>
              {canManage && (
              <button type="button" onClick={() => void onRemove(member.userId)} style={removeStyle}>
                Remove
              </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

const dismissStyle: CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: 'none',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
};

const inputStyle: CSSProperties = {
  background: '#020617',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
};

const inviteButtonStyle: CSSProperties = {
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 13,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 6,
  padding: '10px 12px',
};

const removeStyle: CSSProperties = {
  background: 'transparent',
  color: '#f87171',
  border: '1px solid #7f1d1d',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer',
};
