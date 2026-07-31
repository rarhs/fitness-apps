import { useNavigate } from 'react-router';
import { imageUrl } from '@fitness-apps/exercise-data';
import { Media } from '../components/Media';
import { fmt, REGIONS, TOTAL } from '../lib';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

export function Categories() {
  const navigate = useNavigate();

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 28px 96px' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: 14 }}>
        Ten regions · {fmt(TOTAL)} entries
      </div>
      <h1 style={{ fontSize: 44, letterSpacing: '-0.025em', margin: '0 0 10px' }}>Categories</h1>
      <p className="text-muted" style={{ maxWidth: '54ch', margin: '0 0 38px' }}>
        Every exercise belongs to exactly one region. Counts below are the complete catalogue; each
        entry has a still and an animation, with no gaps.
      </p>
      <div className="vgrid-wide">
        {REGIONS.map((c) => (
          <button key={c.name} className="cat-card" onClick={() => navigate(`/library?cat=${encodeURIComponent(c.name)}`)}>
            <div
              style={{
                height: 118,
                background: 'linear-gradient(140deg, #262a60 0%, #1d2040 55%, #1a1c2b 100%)',
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '14px 16px',
              }}
            >
              <Media src={imageUrl(c.cover)} alt="" dimmed />
              <span style={{ position: 'relative', fontFamily: 'var(--font-heading)', fontSize: 21, textTransform: 'capitalize', letterSpacing: '-0.015em' }}>
                {c.name}
              </span>
            </div>
            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 13, color: muted(62), lineHeight: 1.5 }}>{c.blurb}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: muted(50) }}>
                <span>{c.count} exercises</span>
                <span>{fmt(c.count * 2)} media files</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
