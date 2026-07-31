import { useNavigate } from 'react-router';
import { imageUrl } from '@fitness-apps/exercise-data';
import { Media } from '../components/Media';
import { exerciseById, pad2, setsNumber } from '../lib';
import { useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;
const WORK_SEC_PER_SET = 40;

export function Builder() {
  const navigate = useNavigate();
  const { routine, setRoutine, removeFromRoutine } = useAppState();

  const rows = routine.items
    .map((item, i) => ({ item, i, ex: exerciseById(item.id) }))
    .filter((r) => r.ex !== undefined);

  const totalSets = rows.reduce((n, r) => n + setsNumber(r.item.sets), 0);
  const estMin = Math.round((totalSets * (WORK_SEC_PER_SET + routine.restSec)) / 60);

  const regionCounts = new Map<string, number>();
  for (const r of rows) {
    regionCounts.set(r.ex!.body_part, (regionCounts.get(r.ex!.body_part) ?? 0) + 1);
  }
  const coverage = [...regionCounts.entries()].map(([name, n]) => ({
    name,
    pct: Math.round((n / Math.max(rows.length, 1)) * 100),
  }));

  const summary = [
    { label: 'Movements', value: String(rows.length) },
    { label: 'Working sets', value: String(totalSets) },
    { label: 'Estimated time', value: `${estMin} min` },
    { label: 'Regions covered', value: String(regionCounts.size) },
  ];

  const patchItem = (id: string, patch: Partial<{ sets: string; reps: string }>) =>
    setRoutine((r) => ({
      ...r,
      items: r.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 28px 96px' }}>
      <div className="vsplit" style={{ gridTemplateColumns: 'minmax(0, 1fr) 360px' }}>
        <section>
          <h1 style={{ fontSize: 36, letterSpacing: '-0.025em', margin: '0 0 6px' }}>Routine editor</h1>
          <p className="text-muted" style={{ margin: '0 0 26px' }}>
            {routine.name} · {rows.length} movements · est. {estMin} minutes
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(({ item, i, ex }) => (
              <div key={item.id} className="routine-row">
                <span style={{ fontSize: 12, color: muted(40) }}>{pad2(i + 1)}</span>
                <button
                  className="thumb"
                  style={{ width: 56, height: 56 }}
                  onClick={() => navigate(`/exercise/${item.id}`)}
                  title={ex!.name}
                >
                  <Media src={imageUrl(ex!)} alt="" />
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, textTransform: 'capitalize' }}>
                    {ex!.name}
                  </span>
                  <span style={{ fontSize: 11, color: muted(50), textTransform: 'capitalize' }}>
                    {ex!.body_part} · {ex!.equipment}
                  </span>
                </div>
                <div className="routine-row-inputs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    className="input"
                    value={item.sets}
                    onChange={(e) => patchItem(item.id, { sets: e.target.value })}
                    style={{ width: 46, textAlign: 'center', padding: 4 }}
                    aria-label="Sets"
                  />
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    ×
                  </span>
                  <input
                    className="input"
                    value={item.reps}
                    onChange={(e) => patchItem(item.id, { reps: e.target.value })}
                    style={{ width: 52, textAlign: 'center', padding: 4 }}
                    aria-label="Reps"
                  />
                  <button
                    className="btn btn-icon"
                    style={{ border: '1px solid var(--color-divider)', fontSize: 16, lineHeight: 1 }}
                    onClick={() => removeFromRoutine(item.id)}
                    aria-label={`Remove ${ex!.name}`}
                  >
                    −
                  </button>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div style={{ padding: '40px 0', color: muted(55) }}>
                No movements yet — add exercises from the library.
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={() => navigate('/library')}>
            + Add from library
          </button>
        </section>

        <aside
          style={{
            position: 'sticky',
            top: 82,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div>
            <h6 style={{ color: muted(60), marginBottom: 10 }}>Session summary</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summary.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 13 }}>
                  <span className="text-muted">{s.label}</span>
                  <span>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h6 style={{ color: muted(60), marginBottom: 10 }}>Coverage</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {coverage.map((c) => (
                <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, textTransform: 'capitalize' }}>
                    <span>{c.name}</span>
                    <span className="text-muted">{c.pct}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--color-neutral-800)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, background: 'var(--color-accent)' }} />
                  </div>
                </div>
              ))}
              {coverage.length === 0 && (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Add movements to see coverage.
                </span>
              )}
            </div>
          </div>
          <div className="field">
            <label>Rest between sets (seconds)</label>
            <input
              className="input"
              value={String(routine.restSec)}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setRoutine((r) => ({ ...r, restSec: Number.isFinite(n) && n >= 0 ? n : 0 }));
              }}
              inputMode="numeric"
            />
          </div>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/session')} disabled={rows.length === 0}>
            Start session
          </button>
        </aside>
      </div>
    </main>
  );
}
