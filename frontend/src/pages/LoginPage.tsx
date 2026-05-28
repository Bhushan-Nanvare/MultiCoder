import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

export function LoginPage(): JSX.Element {
  const { status, login } = useAuth();

  useEffect(() => {
    document.title = 'MultiCoder — Sign in';
  }, []);

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#020617',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 10,
          padding: '32px 28px',
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginTop: 0 }}>MultiCoder</h1>
        <p style={{ opacity: 0.75, marginBottom: 24 }}>
          Real-time collaborative code editor with AI review.
        </p>
        <button
          type="button"
          onClick={login}
          disabled={status === 'loading'}
          style={{
            width: '100%',
            background: '#0f172a',
            color: 'white',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 15,
            cursor: status === 'loading' ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <GithubMark />
          {status === 'loading' ? 'Checking session…' : 'Sign in with GitHub'}
        </button>
        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 20 }}>
          We use your GitHub profile (name, username, avatar, email) only to identify you.
        </p>
      </section>
    </main>
  );
}

function GithubMark(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.71 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.44-2.69 5.42-5.26 5.7.41.36.78 1.07.78 2.16 0 1.56-.02 2.81-.02 3.19 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
