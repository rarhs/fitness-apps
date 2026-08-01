import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { gifUrl, imageUrl } from '@fitness-apps/exercise-data';
import { Media } from '../components/Media';
import { exerciseById, formatDay, formatDuration, repsNumber, setsNumber } from '../lib';
import {
  buildSessionRecord,
  lastLoggedSets,
  setPrefill,
  summarizeSets,
  type LoggedSet,
} from '../session-math';
import { useAppState } from '../state';

const muted = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

export function Session() {
  const navigate = useNavigate();
  const { routine, profile, addSession, history } = useAppState();
  const unit = profile.units;

  const movements = useMemo(
    () =>
      routine.items
        .map((item) => ({ item, ex: exerciseById(item.id) }))
        .filter((m) => m.ex !== undefined)
        .map((m) => ({ item: m.item, ex: m.ex!, setCount: setsNumber(m.item.sets) })),
    [routine.items],
  );

  const [movementIdx, setMovementIdx] = useState(0);
  const [logs, setLogs] = useState<Record<number, LoggedSet[]>>({});
  const [startTs] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [repsVal, setRepsVal] = useState('');
  const [loadVal, setLoadVal] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const lastTimes = useMemo(
    () => movements.map((m) => lastLoggedSets(history, m.item.id, unit)),
    [movements, history, unit],
  );

  const current = movements[movementIdx];
  const currentLogs = logs[movementIdx] ?? [];
  const currentSet = currentLogs.length;

  useEffect(() => {
    if (!current) return;
    const pre = setPrefill(
      lastTimes[movementIdx]?.sets[currentSet],
      current.item.reps,
      (logs[movementIdx] ?? []).slice(-1)[0]?.load,
    );
    setRepsVal(pre.reps);
    setLoadVal(pre.load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementIdx, currentSet]);

  if (movements.length === 0) {
    return (
      <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 28 }}>
        <div style={{ textAlign: 'center' }}>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            The routine is empty — add movements before starting a session.
          </p>
          <Link className="btn btn-primary" to="/builder">
            Open the routine editor
          </Link>
        </div>
      </main>
    );
  }

  const totalSets = movements.reduce((n, m) => n + m.setCount, 0);
  const loggedSets = Object.values(logs).reduce((n, l) => n + l.length, 0);
  const pct = Math.round((loggedSets / Math.max(totalSets, 1)) * 100);
  const lastTime = lastTimes[movementIdx];

  const finish = (finalLogs: Record<number, LoggedSet[]>) => {
    const rec = buildSessionRecord({
      movements: movements.map((m) => ({ id: m.item.id, bodyPart: m.ex.body_part, setCount: m.setCount })),
      logs: finalLogs,
      unit,
      name: routine.name,
      startMs: startTs,
      endMs: Date.now(),
    });
    addSession(rec);
    navigate('/progress');
  };

  const logSet = () => {
    const reps = parseInt(repsVal, 10);
    const load = parseFloat(loadVal);
    const entry: LoggedSet = {
      reps: Number.isFinite(reps) ? reps : repsNumber(current.item.reps),
      load: Number.isFinite(load) ? load : 0,
    };
    const nextLogs = { ...logs, [movementIdx]: [...currentLogs, entry] };
    setLogs(nextLogs);
    const done = currentLogs.length + 1 >= current.setCount;
    if (done) {
      if (movementIdx + 1 < movements.length) setMovementIdx(movementIdx + 1);
      else finish(nextLogs);
    }
  };

  const setRows = Array.from({ length: current.setCount }, (_, i) => {
    const logged = currentLogs[i];
    const isCurrent = i === currentSet;
    return { n: i + 1, logged, isCurrent, last: lastTime?.sets[i] };
  });

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 28px', boxShadow: '0 1px 0 var(--color-divider)' }}>
        <button className="btn btn-ghost" style={{ marginLeft: -4 }} onClick={() => navigate('/builder')}>
          Exit
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: muted(60) }}>
            <span>
              {routine.name} · exercise {movementIdx + 1} of {movements.length}
            </span>
            <span>{formatDuration((now - startTs) / 1000)} elapsed</span>
          </div>
          <div style={{ height: 2, background: 'var(--color-neutral-800)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'var(--color-accent)',
                boxShadow: '0 0 14px color-mix(in srgb, var(--color-accent) 60%, transparent)',
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 1080, width: '100%', margin: '0 auto', padding: '40px 28px' }}>
        <div className="vsplit">
          <div
            style={{
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'radial-gradient(70% 70% at 50% 35%, #262941 0%, #191b2a 100%)',
              aspectRatio: '1',
              position: 'relative',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: muted(26) }}>
              {current.ex.gif_url}
            </span>
            <Media src={gifUrl(current.ex)} alt={current.ex.name} contain />
          </div>
          <div>
            <span className="tag tag-accent" style={{ textTransform: 'capitalize' }}>
              {current.ex.body_part}
            </span>
            <h1 style={{ fontSize: 38, letterSpacing: '-0.03em', margin: '14px 0 20px', textTransform: 'capitalize' }}>
              {current.ex.name}
            </h1>
            {lastTime && (
              <p style={{ fontSize: 13, color: muted(55), margin: '-8px 0 20px' }}>
                Last time · {formatDay(lastTime.date)} — {summarizeSets(lastTime.sets, unit)}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 26 }}>
              {setRows.map((s) => (
                <div
                  key={s.n}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '46px 1fr 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${
                      s.logged
                        ? 'color-mix(in srgb, var(--color-accent) 40%, transparent)'
                        : s.isCurrent
                          ? 'var(--color-accent-700)'
                          : 'var(--color-divider)'
                    }`,
                    background: s.logged ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 12, color: muted(50) }}>Set {s.n}</span>
                  {s.logged ? (
                    <>
                      <span style={{ fontSize: 14 }}>{s.logged.reps} reps</span>
                      <span style={{ fontSize: 14 }}>
                        {s.logged.load > 0 ? `${s.logged.load} ${unit}` : '—'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-accent)' }}>logged</span>
                    </>
                  ) : s.isCurrent ? (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <input
                          className="input"
                          value={repsVal}
                          onChange={(e) => setRepsVal(e.target.value)}
                          style={{ padding: 4, textAlign: 'center', flex: 1, minWidth: 0 }}
                          inputMode="numeric"
                          aria-label="Reps"
                        />
                        <span style={{ fontSize: 12, color: muted(55), flex: 'none' }}>reps</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <input
                          className="input"
                          value={loadVal}
                          onChange={(e) => setLoadVal(e.target.value)}
                          style={{ padding: 4, textAlign: 'center', flex: 1, minWidth: 0 }}
                          inputMode="decimal"
                          aria-label={`Load (${unit})`}
                        />
                        <span style={{ fontSize: 12, color: muted(55), flex: 'none' }}>{unit}</span>
                      </span>
                      <span style={{ fontSize: 12, color: muted(55) }}>current</span>
                    </>
                  ) : s.last ? (
                    <>
                      <span style={{ fontSize: 14 }}>{s.last.reps} reps</span>
                      <span style={{ fontSize: 14, color: muted(55) }}>
                        {s.last.load > 0 ? `${s.last.load} ${unit}` : '—'}
                      </span>
                      <span style={{ fontSize: 12, color: muted(55) }}>last time</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 14 }}>{current.item.reps} reps</span>
                      <span style={{ fontSize: 14, color: muted(55) }}>target</span>
                      <span style={{ fontSize: 12, color: muted(55) }}>—</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setMovementIdx(Math.max(movementIdx - 1, 0))}
                disabled={movementIdx === 0}
              >
                Previous
              </button>
              <button className="btn btn-primary" onClick={logSet}>
                {loggedSets + 1 >= totalSets && currentSet + 1 >= current.setCount
                  ? 'Log set · finish'
                  : 'Log set · next'}
              </button>
              <span className="text-muted" style={{ fontSize: 12, marginLeft: 4 }}>
                Rest {routine.restSec}s
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 28px 26px', boxShadow: '0 -1px 0 var(--color-divider)', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {movements.map((m, i) => (
          <button
            key={m.item.id}
            className={`thumb${i === movementIdx ? ' current' : ''}`}
            style={{ flex: 'none', width: 64, height: 64, opacity: i === movementIdx ? 1 : 0.55 }}
            onClick={() => setMovementIdx(i)}
            title={m.ex.name}
          >
            <Media src={imageUrl(m.ex)} alt={m.ex.name} />
          </button>
        ))}
      </div>
    </main>
  );
}
