import { useNavigate } from 'react-router';
import { EXERCISE_INDEX } from '@fitness-apps/exercise-data';
import { ExerciseCard } from '../components/ExerciseCard';
import { fmt, MAX_REGION_COUNT, MEDIA_COUNT, REGIONS, TOTAL, exerciseById } from '../lib';
import { useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

export function Home() {
  const navigate = useNavigate();
  const { recents } = useAppState();

  const heroStats = [
    { label: 'Exercises', value: fmt(TOTAL) },
    { label: 'Media files', value: fmt(MEDIA_COUNT) },
    { label: 'Regions', value: String(REGIONS.length) },
    { label: 'Coverage', value: '100%' },
  ];

  const recentExercises = recents.map(exerciseById).filter((e) => e !== undefined).slice(0, 5);
  const showing = recentExercises.length > 0 ? recentExercises : EXERCISE_INDEX.slice(3, 8);

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '76px 28px 96px' }}>
      <div className="vhero">
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: 20 }}>
            Reference library · v2.4
          </div>
          <h1 style={{ fontSize: 68, lineHeight: 1.02, letterSpacing: '-0.03em', margin: '0 0 22px', maxWidth: '12ch' }}>
            Every exercise, catalogued.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: '46ch', color: muted(72), margin: '0 0 30px' }}>
            {fmt(TOTAL)} movements across ten regions. Each entry carries a still frame, a
            full-range animation, target and secondary musculature, equipment, and step-by-step
            execution notes.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/library')}>
              Browse the library
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/builder')}>
              Build a routine
            </button>
          </div>
        </div>
        <div className="stat-panel">
          {heroStats.map((s) => (
            <div key={s.label} className="stat-cell" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted(55) }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 26, letterSpacing: '-0.02em' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <hr className="hr" style={{ margin: '64px 0 40px' }} />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, margin: 0 }}>Regions</h2>
        <button className="btn btn-ghost" onClick={() => navigate('/categories')}>
          All ten →
        </button>
      </div>
      <div className="vgrid-wide">
        {REGIONS.slice(0, 6).map((c) => (
          <button key={c.name} className="region-card" onClick={() => navigate(`/library?cat=${encodeURIComponent(c.name)}`)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, textTransform: 'capitalize' }}>{c.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-accent)' }}>{c.count}</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--color-neutral-800)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.round((c.count / MAX_REGION_COUNT) * 100)}%`,
                  background: 'var(--color-accent)',
                  boxShadow: '0 0 12px color-mix(in srgb, var(--color-accent) 60%, transparent)',
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: muted(50) }}>{c.blurb}</span>
          </button>
        ))}
      </div>

      <hr className="hr" style={{ margin: '56px 0 40px' }} />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, margin: 0 }}>Recently referenced</h2>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {recentExercises.length > 0 ? 'Stored on this device' : 'From the catalogue'}
        </span>
      </div>
      <div className="vgrid">
        {showing.map((x) => (
          <ExerciseCard key={x.id} exercise={x} />
        ))}
      </div>
    </main>
  );
}
