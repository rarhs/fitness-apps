import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { initials, useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

const PREFS: { name: string; hint: string }[] = [
  { name: 'Autoplay animations on detail pages', hint: 'Loops the GIF as soon as an exercise opens' },
  { name: 'Play animations in grid thumbnails', hint: 'Heavier on data; stills are used by default' },
  { name: 'Rest timer sound', hint: 'A single tone when the rest interval ends' },
  { name: 'Weekly summary email', hint: 'Sent Monday morning' },
];

export function Settings() {
  const navigate = useNavigate();
  const { profile, setProfile, prefs, togglePref } = useAppState();
  const nameRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const memberYear = new Date(profile.memberSince).getFullYear();

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 28px 96px' }}>
      <h1 style={{ fontSize: 40, letterSpacing: '-0.03em', margin: '0 0 32px' }}>Profile &amp; settings</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingBottom: 26 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '1px solid var(--color-accent)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-heading)',
            fontSize: 20,
            color: 'var(--color-accent)',
            boxShadow: '0 0 26px color-mix(in srgb, var(--color-accent) 28%, transparent)',
          }}
        >
          {initials(profile.name)}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>{profile.name}</div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {profile.email || 'no email set'} · member since {memberYear}
          </div>
        </div>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => nameRef.current?.focus()}>
          Edit
        </button>
      </div>
      <hr className="hr" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, margin: '26px 0 30px' }}>
        <div className="field">
          <label>Display name</label>
          <input
            ref={nameRef}
            className="input"
            value={profile.name}
            onChange={(e) => setProfile({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} />
        </div>
        <div className="field">
          <label>Units</label>
          <div className="seg">
            <label className="seg-opt">
              <input type="radio" name="u" checked={profile.units === 'kg'} onChange={() => setProfile({ units: 'kg' })} />
              Kilograms
            </label>
            <label className="seg-opt">
              <input type="radio" name="u" checked={profile.units === 'lb'} onChange={() => setProfile({ units: 'lb' })} />
              Pounds
            </label>
          </div>
        </div>
        <div className="field">
          <label>Default rest (seconds)</label>
          <input
            className="input"
            value={String(profile.defaultRestSec)}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setProfile({ defaultRestSec: Number.isFinite(n) && n >= 0 ? n : 0 });
            }}
            inputMode="numeric"
          />
        </div>
      </div>
      <h6 style={{ color: muted(60), marginBottom: 12 }}>Preferences</h6>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 30 }}>
        {PREFS.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              padding: '13px 0',
              boxShadow: '0 1px 0 color-mix(in srgb, var(--color-text) 8%, transparent)',
            }}
          >
            <div>
              <div style={{ fontSize: 14 }}>{p.name}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {p.hint}
              </div>
            </div>
            <button
              className={`toggle${prefs[i] ? ' on' : ''}`}
              onClick={() => togglePref(i)}
              role="switch"
              aria-checked={prefs[i]}
              aria-label={p.name}
            >
              <span className="knob" />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          {saved ? 'Saved ✓' : 'Save changes'}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/auth')}>
          Sign out
        </button>
      </div>
    </main>
  );
}
