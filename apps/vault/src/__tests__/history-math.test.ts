import { describe, expect, it } from 'vitest';
import {
  WEEK_MS,
  WINDOW_WEEKS,
  avgDurationMin,
  distinctExerciseCount,
  inWindow,
  regionBalance,
  splitWindows,
  totalTonnageKg,
  weeklyVolumes,
} from '../history-math';
import type { SessionRecord } from '../state';

const NOW = Date.UTC(2026, 6, 31, 12, 0, 0);

function rec(daysAgo: number, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
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
