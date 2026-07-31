import { useState } from 'react';
import { useNavigate } from 'react-router';
import { EXERCISE_INDEX, imageUrl } from '@fitness-apps/exercise-data';
import { useAuth } from '../auth-context';
import { Media } from '../components/Media';
import { MEDIA_COUNT, REGIONS, TOTAL, fmt } from '../lib';

export function Auth() {
  const navigate = useNavigate();
  const { enabled, ready, session, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    setError(null);
    const message = await signInWithGoogle();
    // On success the browser navigates away; reaching here means it didn't.
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  return (
    <main className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.85fr)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px clamp(28px, 7vw, 104px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 54 }}>
          <span className="brand-mark">
            <span />
          </span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>Vault</span>
        </div>
        <h1 style={{ fontSize: 42, letterSpacing: '-0.03em', margin: '0 0 10px' }}>Sign in</h1>
        <p className="text-muted" style={{ maxWidth: '40ch', margin: '0 0 30px' }}>
          The full catalogue is open to read. An account keeps your routines and logged sessions.
        </p>
        <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {session ? (
            <>
              <p style={{ margin: 0, fontSize: 14 }}>
                Signed in as <strong>{session.user.email}</strong>
              </p>
              <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
                Enter the vault →
              </button>
            </>
          ) : enabled ? (
            <>
              <button className="btn btn-primary btn-block" onClick={google} disabled={busy || !ready}>
                {busy ? 'Opening Google…' : 'Continue with Google'}
              </button>
              {error && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-danger, #e5484d)' }}>{error}</p>
              )}
            </>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              Sign-in is not configured in this build.
            </p>
          )}
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/')}>
            Browse without an account →
          </button>
        </div>
      </div>
      <div
        className="auth-art"
        style={{
          background: 'linear-gradient(160deg, #262a60 0%, #1d2040 50%, #16182a 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 48,
          gap: 22,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {EXERCISE_INDEX.slice(0, 9).map((t) => (
            <div
              key={t.id}
              style={{
                aspectRatio: '1',
                borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, #e9e9ed 5%, transparent)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Media src={imageUrl(t)} alt="" />
            </div>
          ))}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: '34ch', margin: 0, color: 'color-mix(in srgb, var(--color-text) 82%, transparent)' }}>
          {fmt(TOTAL)} exercises. {fmt(MEDIA_COUNT)} media files. {REGIONS.length === 10 ? 'Ten' : String(REGIONS.length)}{' '}
          regions, no gaps.
        </p>
      </div>
    </main>
  );
}
