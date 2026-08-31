import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import {
  SUPPORTED_LANGUAGES,
  type ProjectTemplateId,
  type ProjectTemplateSummary,
  type Room,
  type SupportedLanguage,
} from '@/types/room';

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('javascript');
  const [templateId, setTemplateId] = useState<ProjectTemplateId | ''>('');

  const selectedTemplate = templates.find((template) => template.id === templateId);

  useEffect(() => {
    let cancelled = false;
    api
      .listRooms()
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load rooms');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    api
      .listRoomTemplates()
      .then((starterTemplates) => {
        if (!cancelled) setTemplates(starterTemplates);
      })
      .catch(() => {
        /* Blank create still works; picker lists only Blank. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTemplateChange = (value: string): void => {
    if (value === '') {
      setTemplateId('');
      return;
    }
    const next = templates.find((template) => template.id === value);
    if (!next) return;
    setTemplateId(next.id);
    setLanguage(next.language);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const room = await api.createRoom({
        name: name.trim() || undefined,
        language: selectedTemplate?.language ?? language,
        ...(templateId ? { templateId } : {}),
      });
      navigate(`/rooms/${room.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '32px 24px',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <h1 style={{ margin: 0 }}>MultiCoder</h1>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                width={32}
                height={32}
                style={{ borderRadius: '50%' }}
              />
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13 }}>{user.displayName}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>@{user.username}</div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <p style={{ opacity: 0.8 }}>Create a room, share the link, and code together in real time.</p>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Start a new room</h2>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Name (optional)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Pairing session"
              style={inputStyle}
              maxLength={120}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Template</span>
            <select
              value={templateId}
              onChange={(event) => handleTemplateChange(event.target.value)}
              style={inputStyle}
            >
              <option value="">Blank (empty project)</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} — {template.fileCount} file{template.fileCount === 1 ? '' : 's'}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <span style={{ fontSize: 12, opacity: 0.7 }}>{selectedTemplate.description}</span>
            )}
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Language</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
              style={inputStyle}
              disabled={Boolean(selectedTemplate)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                Locked to {selectedTemplate.language} for this template.
              </span>
            )}
          </label>
          <button type="submit" disabled={creating} style={buttonStyle}>
            {creating ? 'Creating…' : 'Create room'}
          </button>
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Your rooms</h2>
        {loading && <p>Loading…</p>}
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        {!loading && rooms.length === 0 && (
          <p style={{ opacity: 0.7 }}>No rooms yet — create one above.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {rooms.map((room) => (
            <li
              key={room.id}
              style={{
                background: '#0b1220',
                border: '1px solid #1e293b',
                borderRadius: 6,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{room.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {room.language} · created {new Date(room.createdAt).toLocaleString()}
                </div>
              </div>
              <Link to={`/rooms/${room.id}`} style={{ color: '#60a5fa' }}>
                Open →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const cardStyle: CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 8,
  padding: 20,
  marginTop: 24,
};

const inputStyle: CSSProperties = {
  background: '#0b1220',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 14,
};

const buttonStyle: CSSProperties = {
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 14,
  cursor: 'pointer',
  justifySelf: 'start',
};
