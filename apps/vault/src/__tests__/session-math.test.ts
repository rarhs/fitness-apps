import { describe, expect, it } from 'vitest';
import {
  aggregateRegions,
  buildSessionRecord,
  lastLoggedSets,
  sessionVolumeKg,
  setPrefill,
  summarizeSets,
  targetReps,
  type LoggedSet,
  type SessionMovement,
} from '../session-math';
import type { SessionRecord } from '../state';

const MOVEMENTS: SessionMovement[] = [
  { id: '0025', bodyPart: 'chest', setCount: 4 },
  { id: '0334', bodyPart: 'shoulders', setCount: 4 },
  { id: '0047', bodyPart: 'chest', setCount: 3 },
];

const LOGS: Record<number, LoggedSet[]> = {
  0: [
    { reps: 10, load: 80 },
    { reps: 8, load: 80 },
  ],
  1: [{ reps: 12, load: 20 }],
};

describe('targetReps', () => {
  it('takes the trailing number of a range', () => {
    expect(targetReps('8-10')).toBe('10');
    expect(targetReps('12')).toBe('12');
    expect(targetReps('12-15')).toBe('15');
  });

  it('is empty for non-numeric targets', () => {
    expect(targetReps('AMRAP')).toBe('');
    expect(targetReps('')).toBe('');
  });
});

describe('sessionVolumeKg', () => {
  it('sums reps × load in kg', () => {
    expect(sessionVolumeKg(LOGS, 'kg')).toBe(10 * 80 + 8 * 80 + 12 * 20);
  });

  it('converts pounds to kg', () => {
    expect(sessionVolumeKg({ 0: [{ reps: 10, load: 100 }] }, 'lb')).toBeCloseTo(453.59237, 4);
  });

  it('is zero with no logs', () => {
    expect(sessionVolumeKg({}, 'kg')).toBe(0);
  });
});

describe('aggregateRegions', () => {
  it('counts logged sets per body part, merging movements of one region', () => {
    const logs = { ...LOGS, 2: [{ reps: 10, load: 60 }] };
    expect(aggregateRegions(MOVEMENTS, logs)).toEqual({ chest: 3, shoulders: 1 });
  });

  it('ignores movements with no logged sets and unknown indices', () => {
    expect(aggregateRegions(MOVEMENTS, { 1: [], 7: [{ reps: 5, load: 5 }] })).toEqual({});
  });
});

const session = (over: Partial<SessionRecord>): SessionRecord => ({
  id: 'rec',
  date: '2026-07-20T10:00:00.000Z',
  name: 'Push A',
  durationSec: 3000,
  volumeKg: 1000,
  setCount: 3,
  exerciseIds: [],
  regions: {},
  ...over,
});

describe('lastLoggedSets', () => {
  const older = session({
    id: 'older',
    date: '2026-07-10T10:00:00.000Z',
    exerciseIds: ['0025', '0334'],
    sets: [[{ reps: 9, loadKg: 75 }], [{ reps: 12, loadKg: 20 }]],
  });
  const newer = session({
    id: 'newer',
    date: '2026-07-24T10:00:00.000Z',
    exerciseIds: ['0025'],
    sets: [
      [
        { reps: 10, loadKg: 80 },
        { reps: 8, loadKg: 80 },
      ],
    ],
  });

  it('returns the most recent per-set logs for the exercise, by date not array order', () => {
    expect(lastLoggedSets([older, newer], '0025', 'kg')).toEqual({
      date: newer.date,
      sets: [
        { reps: 10, load: 80 },
        { reps: 8, load: 80 },
      ],
    });
  });

  it('converts stored kg loads to the display unit, rounded to two decimals', () => {
    const rec = session({ exerciseIds: ['0025'], sets: [[{ reps: 10, loadKg: 45.36 }]] });
    expect(lastLoggedSets([rec], '0025', 'lb')).toEqual({
      date: rec.date,
      sets: [{ reps: 10, load: 100 }],
    });
  });

  it('skips legacy records and empty set lists, falling back to older sessions', () => {
    const legacy = session({ id: 'legacy', date: '2026-07-30T10:00:00.000Z', exerciseIds: ['0025'] });
    const empty = session({
      id: 'empty',
      date: '2026-07-28T10:00:00.000Z',
      exerciseIds: ['0025', '0334'],
      sets: [[], [{ reps: 12, loadKg: 20 }]],
    });
    expect(lastLoggedSets([legacy, empty, older], '0025', 'kg')).toEqual({
      date: older.date,
      sets: [{ reps: 9, load: 75 }],
    });
  });

  it('is null for an exercise never logged with sets', () => {
    expect(lastLoggedSets([newer], '0334', 'kg')).toBeNull();
    expect(lastLoggedSets([], '0025', 'kg')).toBeNull();
  });
});

describe('summarizeSets', () => {
  it('joins reps×load with a trailing unit', () => {
    expect(
      summarizeSets(
        [
          { reps: 10, load: 80 },
          { reps: 8, load: 80 },
        ],
        'kg',
      ),
    ).toBe('10×80, 8×80 kg');
  });

  it('drops the load for bodyweight sets', () => {
    expect(
      summarizeSets(
        [
          { reps: 10, load: 20 },
          { reps: 12, load: 0 },
        ],
        'lb',
      ),
    ).toBe('10×20, 12 lb');
  });

  it('labels all-bodyweight logs as reps', () => {
    expect(
      summarizeSets(
        [
          { reps: 12, load: 0 },
          { reps: 10, load: 0 },
        ],
        'kg',
      ),
    ).toBe('12, 10 reps');
  });

  it('is empty with no sets', () => {
    expect(summarizeSets([], 'kg')).toBe('');
  });
});

describe('setPrefill', () => {
  it('prefills both inputs from the same-numbered set last time', () => {
    expect(setPrefill({ reps: 8, load: 77.5 }, '8-10', 80)).toEqual({ reps: '8', load: '77.5' });
  });

  it('falls back to the routine target and the load of the previous set this session', () => {
    expect(setPrefill(undefined, '8-10', 80)).toEqual({ reps: '10', load: '80' });
  });

  it('leaves the load blank on a first set with no history', () => {
    expect(setPrefill(undefined, '8-10', undefined)).toEqual({ reps: '10', load: '' });
  });

  it('keeps this session’s load when last time was bodyweight', () => {
    expect(setPrefill({ reps: 12, load: 0 }, '12-15', 10)).toEqual({ reps: '12', load: '10' });
  });
});

describe('buildSessionRecord', () => {
  const startMs = Date.UTC(2026, 6, 31, 10, 0, 0);
  const endMs = startMs + 52 * 60 * 1000;
  const rec = buildSessionRecord({
    movements: MOVEMENTS,
    logs: LOGS,
    unit: 'kg',
    name: 'Push A',
    startMs,
    endMs,
  });

  it('stamps date, name and duration from the session bounds', () => {
    expect(rec.date).toBe(new Date(endMs).toISOString());
    expect(rec.name).toBe('Push A');
    expect(rec.durationSec).toBe(52 * 60);
  });

  it('aggregates volume, set count, exercises and regions', () => {
    expect(rec.volumeKg).toBe(1680);
    expect(rec.setCount).toBe(3);
    expect(rec.exerciseIds).toEqual(['0025', '0334', '0047']);
    expect(rec.regions).toEqual({ chest: 2, shoulders: 1 });
  });

  it('rounds converted volume to whole kg', () => {
    const lbRec = buildSessionRecord({
      movements: MOVEMENTS,
      logs: { 0: [{ reps: 10, load: 100 }] },
      unit: 'lb',
      name: 'Push A',
      startMs,
      endMs,
    });
    expect(lbRec.volumeKg).toBe(454);
  });

  it('persists per-set logs aligned with the movement order', () => {
    expect(rec.sets).toEqual([
      [
        { reps: 10, loadKg: 80 },
        { reps: 8, loadKg: 80 },
      ],
      [{ reps: 12, loadKg: 20 }],
      [],
    ]);
  });

  it('normalises set loads to kg, rounded to two decimals', () => {
    const lbRec = buildSessionRecord({
      movements: MOVEMENTS,
      logs: { 0: [{ reps: 10, load: 100 }] },
      unit: 'lb',
      name: 'Push A',
      startMs,
      endMs,
    });
    expect(lbRec.sets).toEqual([[{ reps: 10, loadKg: 45.36 }], [], []]);
  });
});
