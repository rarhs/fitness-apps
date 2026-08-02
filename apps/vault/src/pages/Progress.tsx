import { Link, useNavigate } from 'react-router';
import { Sparkline } from '../components/ProgressionChart';
import {
  WINDOW_WEEKS,
  avgDurationMin,
  distinctExerciseCount,
  regionBalance,
  splitWindows,
  topProgressedExercises,
  totalTonnageKg,
  weeklyVolumes,
} from '../history-math';
import { TOTAL, exerciseById, fmt, formatDay } from '../lib';
import { useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

export function Progress() {
  const navigate = useNavigate();
  const { history, profile } = useAppState();
  const now = Date.now();

  const { recent, prior } = splitWindows(history, now);

  if (history.length === 0) {
    return (
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 28px 96px' }}>
        <h1 style={{ fontSize: 40, letterSpacing: '-0.03em', margin: '0 0 6px' }}>Training history</h1>
        <p className="text-muted" style={{ margin: '0 0 32px' }}>
          Nothing logged yet.
        </p>
        <div style={{ padding: '60px 0', color: muted(55) }}>
          <p style={{ marginBottom: 18 }}>
            Sessions you log will appear here — volume, duration and region balance, week by week.
          </p>
          <Link className="btn btn-primary" to="/builder">
            Build a routine and start one
          </Link>
        </div>
      </main>
    );
  }

  const distinct = distinctExerciseCount(recent);
  const durDelta = Math.round(avgDurationMin(recent) - avgDurationMin(prior));
  const tonnageT = totalTonnageKg(recent) / 1000;
  const priorT = totalTonnageKg(prior) / 1000;

  const stats: { label: string; value: string; delta: string; to?: string }[] = [
    {
      label: 'Sessions',
      value: String(recent.length),
      delta:
        prior.length > 0
          ? `${recent.length - prior.length >= 0 ? '+' : ''}${recent.length - prior.length} vs. prior 12 weeks`
          : 'first 12 weeks',
      to: '/sessions',
    },
    {
      label: 'Total tonnage',
      value: tonnageT >= 10 ? `${Math.round(tonnageT)} t` : `${tonnageT.toFixed(1)} t`,
      delta: priorT > 0 ? `${tonnageT >= priorT ? '+' : ''}${(((tonnageT - priorT) / priorT) * 100).toFixed(1)}%` : '—',
    },
    {
      label: 'Avg. duration',
      value: `${Math.round(avgDurationMin(recent))} min`,
      delta: prior.length > 0 ? `${durDelta >= 0 ? '+' : '−'}${Math.abs(durDelta)} min` : '—',
    },
    {
      label: 'Distinct exercises',
      value: String(distinct),
      delta: `${((distinct / TOTAL) * 100).toFixed(1)}% of catalogue`,
    },
  ];

  const weekly = weeklyVolumes(history, now).map((vol, i) => ({ label: `W${i + 1}`, vol }));
  const maxVol = Math.max(...weekly.map((w) => w.vol), 1);

  const balance = regionBalance(recent);
  const maxSets = balance[0]?.[1] ?? 1;

  const progressed = topProgressedExercises(history, profile.units);

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 28px 96px' }}>
      <h1 style={{ fontSize: 40, letterSpacing: '-0.03em', margin: '0 0 6px' }}>Training history</h1>
      <p className="text-muted" style={{ margin: '0 0 32px' }}>
        Twelve weeks · {recent.length} logged {recent.length === 1 ? 'session' : 'sessions'}
      </p>

      <div
        className="stat-panel"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', borderRadius: 'var(--radius-md)', marginBottom: 40 }}
      >
        {stats.map((s) => {
          const cell = (
            <>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted(55), marginBottom: 8 }}>
                {s.label}
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-accent-300)', marginTop: 4 }}>{s.delta}</div>
            </>
          );
          return s.to ? (
            <Link key={s.label} to={s.to} className="stat-cell" style={{ textDecoration: 'none', color: 'inherit' }}>
              {cell}
            </Link>
          ) : (
            <div key={s.label} className="stat-cell">
              {cell}
            </div>
          );
        })}
      </div>

      <h6 style={{ color: muted(60), marginBottom: 14 }}>Weekly volume</h6>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: 168,
          padding: '0 0 12px',
          borderBottom: '1px solid var(--color-divider)',
          marginBottom: 44,
        }}
      >
        {weekly.map((w, i) => (
          <div
            key={w.label}
            className="week-col"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}
          >
            <div
              className="week-bar"
              style={{
                height: `${Math.round((w.vol / maxVol) * 100)}%`,
                minHeight: w.vol > 0 ? 3 : 0,
                background: i === WINDOW_WEEKS - 1 ? 'var(--color-accent)' : undefined,
              }}
              title={`${fmt(w.vol)} kg`}
            />
            <span style={{ fontSize: 10, color: muted(40) }}>{w.label}</span>
          </div>
        ))}
      </div>

      <div className="vsplit">
        <div>
          <h6 style={{ color: muted(60), marginBottom: 12 }}>Recent sessions</h6>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Routine</th>
                <th>Volume</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 6).map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/sessions/${s.id}`);
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`${s.name}, ${formatDay(s.date)}`}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{formatDay(s.date)}</td>
                  <td>{s.name}</td>
                  <td>{s.volumeKg > 0 ? `${fmt(s.volumeKg)} kg` : '—'}</td>
                  <td>{Math.round(s.durationSec / 60)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="btn btn-ghost" to="/sessions" style={{ marginTop: 10, marginLeft: -10 }}>
            All sessions →
          </Link>
        </div>
        <div>
          <h6 style={{ color: muted(60), marginBottom: 12 }}>Region balance</h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {balance.map(([name, sets]) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, textTransform: 'capitalize' }}>
                  <span>{name}</span>
                  <span className="text-muted">{sets} sets</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-neutral-800)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((sets / maxSets) * 100)}%`, background: 'var(--color-accent-500)' }} />
                </div>
              </div>
            ))}
            {balance.length === 0 && (
              <span className="text-muted" style={{ fontSize: 12 }}>
                No sets logged in the last twelve weeks.
              </span>
            )}
          </div>
        </div>
      </div>

      {progressed.length > 0 && (
        <section style={{ marginTop: 44 }}>
          <h6 style={{ color: muted(60), marginBottom: 12 }}>Exercise progression</h6>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {progressed.map(({ id, points }) => {
              const hasLoad = points.some((p) => p.topSet.load > 0);
              const latest = points.at(-1)!;
              const delta = hasLoad
                ? Math.round((latest.topSet.load - points[0]!.topSet.load) * 100) / 100
                : latest.bestReps - points[0]!.bestReps;
              const deltaUnit = hasLoad ? profile.units : 'reps';
              return (
                <Link key={id} to={`/exercise/${id}`} className="prog-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 14,
                        textTransform: 'capitalize',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {exerciseById(id)?.name ?? id}
                    </span>
                    <span className="text-muted" style={{ fontSize: 11, flexShrink: 0 }}>
                      {points.length} sessions
                    </span>
                  </div>
                  <Sparkline values={points.map((p) => (hasLoad ? p.topSet.load : p.bestReps))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                    <span className="text-muted">
                      {hasLoad
                        ? `Top set ${latest.topSet.reps}×${latest.topSet.load} ${profile.units}`
                        : `Best ${latest.bestReps} reps`}
                    </span>
                    <span style={{ color: 'var(--color-accent-300)', flexShrink: 0 }}>
                      {delta === 0 ? '—' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${deltaUnit}`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
