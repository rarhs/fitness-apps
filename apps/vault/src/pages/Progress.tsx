import { Link } from 'react-router';
import { TOTAL, fmt, formatDay } from '../lib';
import { useAppState, type SessionRecord } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_WEEKS = 12;

function inWindow(rec: SessionRecord, now: number, fromWeeks: number, toWeeks: number): boolean {
  const age = now - new Date(rec.date).getTime();
  return age >= fromWeeks * WEEK_MS && age < toWeeks * WEEK_MS;
}

export function Progress() {
  const { history } = useAppState();
  const now = Date.now();

  const recent = history.filter((r) => inWindow(r, now, 0, WINDOW_WEEKS));
  const prior = history.filter((r) => inWindow(r, now, WINDOW_WEEKS, WINDOW_WEEKS * 2));

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

  const tonnage = (recs: SessionRecord[]) => recs.reduce((n, r) => n + r.volumeKg, 0);
  const avgDur = (recs: SessionRecord[]) =>
    recs.length === 0 ? 0 : recs.reduce((n, r) => n + r.durationSec, 0) / recs.length / 60;

  const distinct = new Set(recent.flatMap((r) => r.exerciseIds)).size;
  const durDelta = Math.round(avgDur(recent) - avgDur(prior));
  const tonnageT = tonnage(recent) / 1000;
  const priorT = tonnage(prior) / 1000;

  const stats = [
    {
      label: 'Sessions',
      value: String(recent.length),
      delta:
        prior.length > 0
          ? `${recent.length - prior.length >= 0 ? '+' : ''}${recent.length - prior.length} vs. prior 12 weeks`
          : 'first 12 weeks',
    },
    {
      label: 'Total tonnage',
      value: tonnageT >= 10 ? `${Math.round(tonnageT)} t` : `${tonnageT.toFixed(1)} t`,
      delta: priorT > 0 ? `${tonnageT >= priorT ? '+' : ''}${(((tonnageT - priorT) / priorT) * 100).toFixed(1)}%` : '—',
    },
    {
      label: 'Avg. duration',
      value: `${Math.round(avgDur(recent))} min`,
      delta: prior.length > 0 ? `${durDelta >= 0 ? '+' : '−'}${Math.abs(durDelta)} min` : '—',
    },
    {
      label: 'Distinct exercises',
      value: String(distinct),
      delta: `${((distinct / TOTAL) * 100).toFixed(1)}% of catalogue`,
    },
  ];

  const weekly = Array.from({ length: WINDOW_WEEKS }, (_, i) => {
    const bucket = WINDOW_WEEKS - 1 - i; // weeks ago
    const vol = history
      .filter((r) => inWindow(r, now, bucket, bucket + 1))
      .reduce((n, r) => n + r.volumeKg, 0);
    return { label: `W${i + 1}`, vol };
  });
  const maxVol = Math.max(...weekly.map((w) => w.vol), 1);

  const regionTotals = new Map<string, number>();
  for (const r of recent) {
    for (const [name, sets] of Object.entries(r.regions)) {
      regionTotals.set(name, (regionTotals.get(name) ?? 0) + sets);
    }
  }
  const balance = [...regionTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSets = balance[0]?.[1] ?? 1;

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
        {stats.map((s) => (
          <div key={s.label} className="stat-cell">
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted(55), marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-accent-300)', marginTop: 4 }}>{s.delta}</div>
          </div>
        ))}
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
              {history.slice(0, 6).map((s, i) => (
                <tr key={i}>
                  <td>{formatDay(s.date)}</td>
                  <td>{s.name}</td>
                  <td>{s.volumeKg > 0 ? `${fmt(s.volumeKg)} kg` : '—'}</td>
                  <td>{Math.round(s.durationSec / 60)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </main>
  );
}
