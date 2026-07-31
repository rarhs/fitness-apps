import { describe, expect, it } from 'vitest';
import {
  aggregateRegions,
  buildSessionRecord,
  sessionVolumeKg,
  targetReps,
  type LoggedSet,
  type SessionMovement,
} from '../session-math';

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
