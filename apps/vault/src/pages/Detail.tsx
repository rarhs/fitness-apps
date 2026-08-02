import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  EXERCISE_INDEX,
  fetchExercise,
  gifUrl,
  imageUrl,
  instructionSteps,
} from '@fitness-apps/exercise-data';
import { Media } from '../components/Media';
import { ProgressionChart } from '../components/ProgressionChart';
import { exerciseProgression, type ProgressionPoint } from '../history-math';
import { exerciseById, formatDay, pad2 } from '../lib';
import { useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

type StepsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; steps: string[] };

type Metric = 'top' | '1rm' | 'volume';

export function Detail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { addToRoutine, toggleSaved, saved, pushRecent, prefs, history, profile } = useAppState();
  const autoplay = prefs[0] ?? true;
  const entry = exerciseById(id);

  const [steps, setSteps] = useState<StepsState>({ status: 'loading' });
  const [metric, setMetric] = useState<Metric>('top');

  const units = profile.units;
  const progression = useMemo(() => exerciseProgression(history, id, units), [history, id, units]);
  const hasLoad = progression.some((p) => p.topSet.load > 0);

  useEffect(() => {
    if (entry) pushRecent(entry.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setSteps({ status: 'loading' });
    fetchExercise(id)
      .then((full) => {
        if (cancelled) return;
        setSteps(full ? { status: 'ready', steps: instructionSteps(full, 'en') } : { status: 'error' });
      })
      .catch(() => {
        if (!cancelled) setSteps({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const metricDefs: Record<Metric, { label: string; value: (p: ProgressionPoint) => number }> = {
    top: { label: 'Top set', value: (p) => p.topSet.load },
    '1rm': { label: 'Est. 1RM', value: (p) => p.estOneRm },
    volume: { label: 'Volume', value: (p) => p.volume },
  };
  const metricValue = hasLoad ? metricDefs[metric].value : (p: ProgressionPoint) => p.bestReps;
  const metricHeader = hasLoad ? `${metricDefs[metric].label} (${units})` : 'Best reps';
  const pointDetail = (p: ProgressionPoint) =>
    hasLoad ? `top set ${p.topSet.reps}×${p.topSet.load} ${units}` : `best ${p.bestReps} reps`;

  const related = useMemo(() => {
    if (!entry) return [];
    return EXERCISE_INDEX.filter((x) => x.body_part === entry.body_part && x.id !== entry.id)
      .sort((a, b) => Number(b.target === entry.target) - Number(a.target === entry.target))
      .slice(0, 4);
  }, [entry]);

  if (!entry) {
    return (
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 28px 96px' }}>
        <p className="text-muted">No exercise with id “{id}”.</p>
        <Link className="btn btn-ghost" to="/library">
          ← Library
        </Link>
      </main>
    );
  }

  const isSaved = saved.includes(entry.id);

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 28px 96px' }}>
      <button className="btn btn-ghost" style={{ margin: '0 0 22px -4px' }} onClick={() => navigate('/library')}>
        ← Library
      </button>
      <div className="vsplit">
        <div>
          <div
            style={{
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'radial-gradient(70% 70% at 50% 35%, #262941 0%, #191b2a 100%)',
            }}
          >
            <div style={{ aspectRatio: '1', position: 'relative', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: muted(26) }}>
                {entry.gif_url}
              </span>
              <Media src={autoplay ? gifUrl(entry) : imageUrl(entry)} alt={entry.name} contain />
              <span
                className="tag tag-outline"
                style={{ position: 'absolute', top: 12, left: 12, background: 'color-mix(in srgb, #161826 70%, transparent)' }}
              >
                {autoplay ? 'Full range · looping' : 'Still frame'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {related.map((r) => (
              <button
                key={r.id}
                className="thumb"
                style={{ flex: 1, aspectRatio: '1' }}
                onClick={() => navigate(`/exercise/${r.id}`)}
                title={r.name}
              >
                <Media src={imageUrl(r)} alt={r.name} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span className="tag tag-accent" style={{ textTransform: 'capitalize' }}>
              {entry.body_part}
            </span>
            <span className="tag tag-neutral" style={{ textTransform: 'capitalize' }}>
              {entry.equipment}
            </span>
            <span className="text-muted" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
              {entry.id}
            </span>
          </div>
          <h1 style={{ fontSize: 40, lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 26px', textTransform: 'capitalize' }}>
            {entry.name}
          </h1>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              background: 'var(--color-divider)',
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              marginBottom: 28,
            }}
          >
            <div style={{ background: '#1b1d2c', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted(55), marginBottom: 4 }}>
                Target
              </div>
              <div style={{ fontSize: 15, textTransform: 'capitalize' }}>{entry.target}</div>
            </div>
            <div style={{ background: '#1b1d2c', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted(55), marginBottom: 4 }}>
                Secondary
              </div>
              <div style={{ fontSize: 15, textTransform: 'capitalize' }}>
                {entry.secondary_muscles.length > 0 ? entry.secondary_muscles.join(', ') : '—'}
              </div>
            </div>
          </div>

          <h6 style={{ color: muted(60), marginBottom: 12 }}>Execution</h6>
          {steps.status === 'loading' && (
            <p className="text-muted" style={{ fontSize: 14, margin: '0 0 30px' }}>
              Loading execution notes…
            </p>
          )}
          {steps.status === 'error' && (
            <p className="text-muted" style={{ fontSize: 14, margin: '0 0 30px' }}>
              Execution notes could not be loaded. Check your connection and reopen this entry.
            </p>
          )}
          {steps.status === 'ready' && (
            <ol style={{ margin: '0 0 30px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.steps.map((text, i) => (
                <li key={i} style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 12, alignItems: 'start' }}>
                  <span style={{ fontSize: 11, paddingTop: 3, color: 'var(--color-accent)', letterSpacing: '0.08em' }}>
                    {pad2(i + 1)}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: muted(85), textWrap: 'pretty' }}>{text}</span>
                </li>
              ))}
            </ol>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                addToRoutine(entry.id);
                navigate('/builder');
              }}
            >
              Add to routine
            </button>
            <button className={`btn ${isSaved ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleSaved(entry.id)}>
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {progression.length === 1 && (
        <section style={{ marginTop: 46 }}>
          <h6 style={{ color: muted(60), marginBottom: 10 }}>Progression</h6>
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            Logged once — {formatDay(progression[0]!.date)}: {pointDetail(progression[0]!)}. One more
            session draws the line.
          </p>
        </section>
      )}
      {progression.length >= 2 && (
        <section style={{ marginTop: 46 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <h6 style={{ color: muted(60), margin: 0 }}>
              Progression · {progression.length} sessions
            </h6>
            {hasLoad && (
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.keys(metricDefs) as Metric[]).map((k) => (
                  <button
                    key={k}
                    className={`tag chip${metric === k ? ' active' : ''}`}
                    style={{ textTransform: 'none' }}
                    aria-pressed={metric === k}
                    onClick={() => setMetric(k)}
                  >
                    {metricDefs[k].label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ProgressionChart
            points={progression.map((p) => ({ date: p.date, value: metricValue(p), detail: pointDetail(p) }))}
            unit={hasLoad ? units : 'reps'}
            valueHeader={metricHeader}
            ariaLabel={`${entry.name} progression — ${metricHeader} across ${progression.length} sessions`}
          />
        </section>
      )}
    </main>
  );
}
