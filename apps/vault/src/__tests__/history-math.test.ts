import { describe, expect, it } from 'vitest';
import {
  WEEK_MS,
  WINDOW_WEEKS,
  avgDurationMin,
  distinctExerciseCount,
  exerciseProgression,
  inWindow,
  regionBalance,
  splitWindows,
  topProgressedExercises,
  totalTonnageKg,
  weeklyVolumes,
} from '../history-math';
import type { SessionRecord } from '../state';

const NOW = Date.UTC(2026, 6, 31, 12, 0, 0);

function rec(daysAgo: number, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `s-${daysAgo}`,
    date: new Date(NOW - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    name: 'Push A',
    durationSec: 3000,
    volumeKg: 1000,
    setCount: 20,
    exerciseIds: ['0025'],
    regions: { chest: 20 },
    ...overrides,
  };
}

describe('inWindow', () => {
  it('includes a session logged right now and excludes the window edge', () => {
    expect(inWindow(rec(0), NOW, 0, WINDOW_WEEKS)).toBe(true);
    const edge: SessionRecord = { ...rec(0), date: new Date(NOW - WINDOW_WEEKS * WEEK_MS).toISOString() };
    expect(inWindow(edge, NOW, 0, WINDOW_WEEKS)).toBe(false);
    expect(inWindow(edge, NOW, WINDOW_WEEKS, WINDOW_WEEKS * 2)).toBe(true);
  });
});

describe('splitWindows', () => {
  it('separates the current 12 weeks from the prior 12, dropping older history', () => {
    const history = [rec(1), rec(83), rec(85), rec(200)];
    const { recent, prior } = splitWindows(history, NOW);
    expect(recent).toHaveLength(2);
    expect(prior).toHaveLength(1);
  });
});

describe('weeklyVolumes', () => {
  it('buckets volume by week, oldest first, current week last', () => {
    const history = [
      rec(1, { volumeKg: 500 }), // current week → last bucket
      rec(3, { volumeKg: 250 }), // also current week
      rec(8, { volumeKg: 900 }), // one week ago → second-to-last
      rec(100, { volumeKg: 999 }), // outside the window → dropped
    ];
    const weekly = weeklyVolumes(history, NOW);
    expect(weekly).toHaveLength(WINDOW_WEEKS);
    expect(weekly[WINDOW_WEEKS - 1]).toBe(750);
    expect(weekly[WINDOW_WEEKS - 2]).toBe(900);
    expect(weekly.slice(0, WINDOW_WEEKS - 2).every((v) => v === 0)).toBe(true);
  });
});

describe('aggregates', () => {
  const recs = [
    rec(1, { volumeKg: 1200, durationSec: 3600, exerciseIds: ['0025', '0047'], regions: { chest: 8 } }),
    rec(3, { volumeKg: 800, durationSec: 1800, exerciseIds: ['0025', '0334'], regions: { chest: 4, shoulders: 6 } }),
  ];

  it('sums tonnage and averages duration in minutes', () => {
    expect(totalTonnageKg(recs)).toBe(2000);
    expect(avgDurationMin(recs)).toBe(45);
    expect(avgDurationMin([])).toBe(0);
  });

  it('counts distinct exercises across sessions', () => {
    expect(distinctExerciseCount(recs)).toBe(3);
    expect(distinctExerciseCount([])).toBe(0);
  });

  it('ranks regions by logged sets and caps the list', () => {
    expect(regionBalance(recs)).toEqual([
      ['chest', 12],
      ['shoulders', 6],
    ]);
    expect(regionBalance(recs, 1)).toEqual([['chest', 12]]);
    expect(regionBalance([])).toEqual([]);
  });
});

describe('exerciseProgression', () => {
  it('returns one point per session with per-set data, oldest first, skipping legacy records', () => {
    const history = [
      // stored newest-first, like the app's history
      rec(1, { id: 's-new', exerciseIds: ['0025'], sets: [[{ reps: 8, loadKg: 85 }]] }),
      rec(5, { id: 's-legacy', exerciseIds: ['0025'] }), // no per-set data
      rec(7, { id: 's-empty', exerciseIds: ['0025'], sets: [[]] }), // exercise present, nothing logged
      rec(9, { id: 's-other', exerciseIds: ['0047'], sets: [[{ reps: 8, loadKg: 90 }]] }),
      rec(10, { id: 's-old', exerciseIds: ['0025'], sets: [[{ reps: 10, loadKg: 80 }]] }),
    ];
    const points = exerciseProgression(history, '0025', 'kg');
    expect(points.map((p) => p.sessionId)).toEqual(['s-old', 's-new']);
    expect(points[0]!.topSet).toEqual({ reps: 10, load: 80 });
    expect(points[1]!.topSet).toEqual({ reps: 8, load: 85 });
    expect(exerciseProgression([], '0025', 'kg')).toEqual([]);
  });

  it('derives top set (ties go to more reps), best Epley 1RM across sets, volume and best reps', () => {
    const history = [
      rec(1, {
        exerciseIds: ['0025'],
        sets: [
          [
            { reps: 1, loadKg: 100 }, // Epley guard: reps ≤ 1 → the load itself
            { reps: 10, loadKg: 90 }, // best est. 1RM: 90 × (1 + 10/30) = 120
            { reps: 12, loadKg: 100 }, // ties the top load with more reps
          ],
        ],
      }),
    ];
    const [p] = exerciseProgression(history, '0025', 'kg');
    expect(p!.topSet).toEqual({ reps: 12, load: 100 });
    expect(p!.estOneRm).toBe(140); // 100 × (1 + 12/30)
    expect(p!.volume).toBe(1 * 100 + 10 * 90 + 12 * 100);
    expect(p!.bestReps).toBe(12);
  });

  it('merges every appearance of the exercise within one session', () => {
    const history = [
      rec(1, {
        exerciseIds: ['0025', '0047', '0025'],
        sets: [[{ reps: 8, loadKg: 80 }], [{ reps: 5, loadKg: 999 }], [{ reps: 6, loadKg: 85 }]],
      }),
    ];
    const [p] = exerciseProgression(history, '0025', 'kg');
    expect(p!.topSet).toEqual({ reps: 6, load: 85 });
    expect(p!.estOneRm).toBe(102); // 85 × (1 + 6/30) beats 80 × (1 + 8/30)
    expect(p!.volume).toBe(8 * 80 + 6 * 85);
    expect(p!.bestReps).toBe(8);
  });

  it('converts loads to pounds, rounded to two decimals', () => {
    const history = [rec(1, { exerciseIds: ['0025'], sets: [[{ reps: 5, loadKg: 100 }]] })];
    const [p] = exerciseProgression(history, '0025', 'lb');
    expect(p!.topSet.load).toBe(220.46);
    expect(p!.estOneRm).toBe(257.21); // (100 × 7/6) kg in lb
    expect(p!.volume).toBe(1102.31); // 500 kg in lb
  });

  it('keeps bodyweight-only history meaningful through bestReps', () => {
    const history = [
      rec(1, {
        exerciseIds: ['0814'],
        sets: [
          [
            { reps: 12, loadKg: 0 },
            { reps: 15, loadKg: 0 },
          ],
        ],
      }),
    ];
    const [p] = exerciseProgression(history, '0814', 'kg');
    expect(p!.topSet).toEqual({ reps: 15, load: 0 });
    expect(p!.estOneRm).toBe(0);
    expect(p!.volume).toBe(0);
    expect(p!.bestReps).toBe(15);
  });
});

describe('topProgressedExercises', () => {
  const set = (loadKg: number) => [{ reps: 8, loadKg }];

  it('ranks exercises by session count, needing at least two charted sessions', () => {
    const history = [
      rec(1, { id: 'a1', exerciseIds: ['0025', '0334'], sets: [set(80), set(10)] }),
      rec(3, { id: 'a2', exerciseIds: ['0025'], sets: [set(78)] }),
      rec(5, { id: 'a3', exerciseIds: ['0025', '0334'], sets: [set(75), set(9)] }),
      rec(7, { id: 'a4', exerciseIds: ['0047'], sets: [set(60)] }), // only once → excluded
    ];
    const top = topProgressedExercises(history, 'kg');
    expect(top.map((t) => t.id)).toEqual(['0025', '0334']);
    expect(top[0]!.points).toHaveLength(3);
    expect(top[1]!.points).toHaveLength(2);
  });

  it('breaks count ties by the most recent session and caps the list', () => {
    const history = [
      rec(1, { id: 'b1', exerciseIds: ['0334'], sets: [set(10)] }),
      rec(2, { id: 'b2', exerciseIds: ['0025'], sets: [set(80)] }),
      rec(3, { id: 'b3', exerciseIds: ['0334'], sets: [set(9)] }),
      rec(4, { id: 'b4', exerciseIds: ['0025'], sets: [set(75)] }),
    ];
    expect(topProgressedExercises(history, 'kg').map((t) => t.id)).toEqual(['0334', '0025']);
    expect(topProgressedExercises(history, 'kg', 1).map((t) => t.id)).toEqual(['0334']);
  });
});
