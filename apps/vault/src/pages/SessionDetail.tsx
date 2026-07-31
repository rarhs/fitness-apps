import { Link, useNavigate, useParams } from 'react-router';
import { imageUrl } from '@fitness-apps/exercise-data';
import { Media } from '../components/Media';
import { exerciseById, fmt, formatDuration, pad2 } from '../lib';
import { useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

/** One logged session: aggregates, the movements performed, and the region
 * split. Shows what a SessionRecord stores — per-set reps and loads are not
 * persisted, so there is deliberately no set-by-set table here. */
export function SessionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { history } = useAppState();

  const rec = history.find((h) => h.id === id);

  if (!rec) {
    return (
      <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 28 }}>
        <div style={{ textAlign: 'center' }}>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            That session isn't in your history.
          </p>
          <Link className="btn btn-primary" to="/sessions">
            All sessions
          </Link>
        </div>
      </main>
    );
  }

  const when = new Date(rec.date);
  const movements = rec.exerciseIds.map((exId, i) => ({
    exId,
    ex: exerciseById(exId),
    sets: rec.sets?.[i] ?? [],
  }));
  const setLine = (sets: { reps: number; loadKg: number }[]) =>
    sets
      .map((s) => (s.loadKg > 0 ? `${s.reps} × ${s.loadKg.toLocaleString('en-US')} kg` : `${s.reps} reps`))
      .join('  ·  ');
  const regions = Object.entries(rec.regions).sort((a, b) => b[1] - a[1]);
  const maxSets = regions[0]?.[1] ?? 1;

  const stats = [
    { label: 'Duration', value: formatDuration(rec.durationSec) },
    { label: 'Volume', value: rec.volumeKg > 0 ? `${fmt(rec.volumeKg)} kg` : '—' },
    { label: 'Working sets', value: String(rec.setCount) },
    { label: 'Movements', value: String(movements.length) },
  ];

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 28px 96px' }}>
      <button className="btn btn-ghost" style={{ marginLeft: -10, marginBottom: 18 }} onClick={() => navigate('/sessions')}>
        ← All sessions
      </button>
      <h1 style={{ fontSize: 40, letterSpacing: '-0.03em', margin: '0 0 6px' }}>{rec.name}</h1>
      <p className="text-muted" style={{ margin: '0 0 32px' }}>
        {when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
        {when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>

      <div
        className="stat-panel"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderRadius: 'var(--radius-md)', marginBottom: 40 }}
      >
        {stats.map((s) => (
          <div key={s.label} className="stat-cell">
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted(55), marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="vsplit">
        <div>
          <h6 style={{ color: muted(60), marginBottom: 12 }}>Movements</h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {movements.map(({ exId, ex, sets }, i) =>
              ex ? (
                <div key={`${exId}-${i}`} className="routine-row">
                  <span style={{ fontSize: 12, color: muted(40) }}>{pad2(i + 1)}</span>
                  <button
                    className="thumb"
                    style={{ width: 56, height: 56 }}
                    onClick={() => navigate(`/exercise/${exId}`)}
                    title={ex.name}
                  >
                    <Media src={imageUrl(ex)} alt="" />
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, textTransform: 'capitalize' }}>
                      {ex.name}
                    </span>
                    <span style={{ fontSize: 11, color: muted(50), textTransform: 'capitalize' }}>
                      {ex.body_part} · {ex.equipment}
                    </span>
                    {sets.length > 0 && (
                      <span style={{ fontSize: 12, color: muted(70), whiteSpace: 'pre' }}>{setLine(sets)}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div key={`${exId}-${i}`} className="routine-row">
                  <span style={{ fontSize: 12, color: muted(40) }}>{pad2(i + 1)}</span>
                  <span style={{ gridColumn: '2 / -1', fontSize: 13, color: muted(45) }}>
                    #{exId} — no longer in the catalogue
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
        <div>
          <h6 style={{ color: muted(60), marginBottom: 12 }}>Region split</h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {regions.map(([name, sets]) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, textTransform: 'capitalize' }}>
                  <span>{name}</span>
                  <span className="text-muted">
                    {sets} {sets === 1 ? 'set' : 'sets'}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-neutral-800)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((sets / maxSets) * 100)}%`, background: 'var(--color-accent-500)' }} />
                </div>
              </div>
            ))}
            {regions.length === 0 && (
              <span className="text-muted" style={{ fontSize: 12 }}>
                No sets were logged in this session.
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
