import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EXERCISE_INDEX } from '@fitness-apps/exercise-data';
import { ExerciseCard } from '../components/ExerciseCard';
import { EQUIPMENT, fmt, REGIONS, TOTAL } from '../lib';

const PAGE = 60;
const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

export function Library() {
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') ?? 'all';
  const equip = params.get('equip');
  const query = (params.get('q') ?? '').trim().toLowerCase();
  const sort = params.get('sort') === 'region' ? 'region' : 'name';

  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    setLimit(PAGE);
  }, [cat, equip, query, sort]);

  const patch = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const matches = EXERCISE_INDEX.filter(
      (x) =>
        (cat === 'all' || x.body_part === cat) &&
        (!equip || x.equipment === equip) &&
        (!query || x.name.includes(query) || x.target.includes(query) || x.body_part.includes(query)),
    );
    return sort === 'region'
      ? [...matches].sort((a, b) => a.body_part.localeCompare(b.body_part) || a.name.localeCompare(b.name))
      : [...matches].sort((a, b) => a.name.localeCompare(b.name));
  }, [cat, equip, query, sort]);

  const shown = filtered.slice(0, limit);
  const catCount = cat === 'all' ? TOTAL : (REGIONS.find((r) => r.name === cat)?.count ?? 0);

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 28px 96px' }}>
      <div className="vcols">
        <aside style={{ position: 'sticky', top: 82, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <h6 style={{ margin: '0 0 10px', color: muted(60) }}>Region</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button
                className={`filter-row${cat === 'all' ? ' active' : ''}`}
                onClick={() => patch({ cat: null })}
              >
                <span>all regions</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{fmt(TOTAL)}</span>
              </button>
              {REGIONS.map((r) => (
                <button
                  key={r.name}
                  className={`filter-row${cat === r.name ? ' active' : ''}`}
                  onClick={() => patch({ cat: r.name })}
                >
                  <span>{r.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>{fmt(r.count)}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h6 style={{ margin: '0 0 10px', color: muted(60) }}>Equipment</h6>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EQUIPMENT.map((e) => (
                <button
                  key={e.name}
                  className={`tag chip${equip === e.name ? ' active' : ''}`}
                  onClick={() => patch({ equip: equip === e.name ? null : e.name })}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h6 style={{ margin: '0 0 10px', color: muted(60) }}>Sort</h6>
            <div className="seg" style={{ width: '100%' }}>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
                <input type="radio" name="sort" checked={sort === 'name'} onChange={() => patch({ sort: null })} />
                Name
              </label>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
                <input type="radio" name="sort" checked={sort === 'region'} onChange={() => patch({ sort: 'region' })} />
                Region
              </label>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setParams({}, { replace: true })}
          >
            Reset filters
          </button>
        </aside>

        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 34, letterSpacing: '-0.025em', margin: 0, textTransform: 'capitalize' }}>
              {cat === 'all' ? 'All exercises' : cat}
            </h1>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {fmt(shown.length)} shown of {fmt(filtered.length)}
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: 13, margin: '0 0 26px' }}>
            {cat === 'all'
              ? 'Filtered views narrow the catalogue; every entry carries a still and an animation.'
              : `${fmt(catCount)} exercises in this region · ${fmt(catCount * 2)} media files`}
          </p>
          <div className="vgrid">
            {shown.map((x) => (
              <ExerciseCard key={x.id} exercise={x} showCategory />
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '60px 0', textAlign: 'center', color: muted(55) }}>
              No exercises match those filters.
            </div>
          )}
          {filtered.length > limit && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 34 }}>
              <button className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Load {Math.min(PAGE, filtered.length - limit)} more
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
