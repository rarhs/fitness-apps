import { Link, useNavigate } from 'react-router';
import { fmt, formatDay } from '../lib';
import { useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

/** Every logged session, newest first — the un-capped version of the
 * Progress page's six-row table. Rows open the session's detail. */
export function Sessions() {
  const navigate = useNavigate();
  const { history } = useAppState();

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 28px 96px' }}>
      <h1 style={{ fontSize: 40, letterSpacing: '-0.03em', margin: '0 0 6px' }}>All sessions</h1>
      <p className="text-muted" style={{ margin: '0 0 32px' }}>
        {history.length} logged {history.length === 1 ? 'session' : 'sessions'}
      </p>

      {history.length === 0 ? (
        <div style={{ padding: '40px 0', color: muted(55) }}>
          <p style={{ marginBottom: 18 }}>Nothing logged yet.</p>
          <Link className="btn btn-primary" to="/builder">
            Build a routine and start one
          </Link>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Routine</th>
              <th>Volume</th>
              <th>Sets</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
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
                <td>{s.setCount}</td>
                <td>{Math.round(s.durationSec / 60)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
