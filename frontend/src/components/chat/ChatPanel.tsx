import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MAX_MESSAGE_LENGTH, type ChatMessage } from '@/types/chat';

interface ChatPanelProps {
  open: boolean;
  messages: ChatMessage[];
  status: 'connecting' | 'ready' | 'error';
  errorMessage: string | null;
  canPost: boolean;
  currentUserId: string | null;
  onSend: (text: string) => Promise<void>;
  onDismiss: () => void;
}

export function ChatPanel({
  open,
  messages,
  status,
  errorMessage,
  canPost,
  currentUserId,
  onSend,
  onDismiss,
}: ChatPanelProps): JSX.Element | null {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages.length]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await onSend(draft);
      setDraft('');
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
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
        zIndex: 20,
        boxShadow: '-12px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <strong>Room chat</strong>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {status === 'connecting' && <p style={{ opacity: 0.7 }}>Connecting…</p>}
        {status === 'error' && <p style={{ color: '#f87171' }}>{errorMessage}</p>}
        {status === 'ready' && messages.length === 0 && (
          <p style={{ opacity: 0.6 }}>No messages yet.</p>
        )}
        {messages.map((message) => (
          <div key={message.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span
                style={{
                  fontWeight: 600,
                  color: message.userId === currentUserId ? '#60a5fa' : '#e2e8f0',
                }}
              >
                {message.username}
              </span>
              <span style={{ fontSize: 11, opacity: 0.5 }}>
                {new Date(message.at).toLocaleTimeString()}
              </span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {sendError && (
        <div style={{ padding: '6px 16px', color: '#f87171', fontSize: 12 }}>{sendError}</div>
      )}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #1f2937' }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={CHAT_MAX_MESSAGE_LENGTH}
          disabled={!canPost || status !== 'ready'}
          placeholder={canPost ? 'Message the room' : 'Sign in to post'}
          style={{
            flex: 1,
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={!canPost || sending || !draft.trim()}
          style={{
            background: canPost && draft.trim() ? '#2563eb' : '#1f2937',
            color: '#e2e8f0',
            border: 'none',
            borderRadius: 6,
            padding: '8px 14px',
            fontSize: 13,
            cursor: canPost && draft.trim() ? 'pointer' : 'default',
          }}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
