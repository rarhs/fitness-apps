import { describe, expect, it } from 'vitest';
import { EXERCISE_INDEX } from '@fitness-apps/exercise-data';
import {
  EQUIPMENT,
  MAX_REGION_COUNT,
  REGIONS,
  TOTAL,
  exerciseById,
  fmt,
  formatDuration,
  pad2,
  repsNumber,
  setsNumber,
} from '../lib';

describe('dataset derivations', () => {
  it('covers the whole catalogue across regions', () => {
    expect(TOTAL).toBe(EXERCISE_INDEX.length);
    expect(REGIONS.reduce((n, r) => n + r.count, 0)).toBe(TOTAL);
  });

  it('has the ten known regions, sorted by size descending', () => {
    expect(REGIONS).toHaveLength(10);
    for (let i = 1; i < REGIONS.length; i++) {
      expect(REGIONS[i - 1]!.count).toBeGreaterThanOrEqual(REGIONS[i]!.count);
    }
    expect(MAX_REGION_COUNT).toBe(REGIONS[0]!.count);
  });

  it('gives every region a blurb and a cover from that region', () => {
    for (const r of REGIONS) {
      expect(r.blurb).not.toBe('');
      expect(r.cover.body_part).toBe(r.name);
    }
  });

  it('covers the whole catalogue across equipment', () => {
    expect(EQUIPMENT.reduce((n, e) => n + e.count, 0)).toBe(TOTAL);
  });

  it('looks up exercises by id', () => {
    expect(exerciseById('0025')?.name).toBe('barbell bench press');
    expect(exerciseById('nope')).toBeUndefined();
  });
});

describe('formatting helpers', () => {
  it('formats durations as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('pads and formats numbers', () => {
    expect(pad2(3)).toBe('03');
    expect(pad2(12)).toBe('12');
    expect(fmt(1324)).toBe('1,324');
  });
});

describe('reps and sets parsing', () => {
  it('takes the leading number of a reps range', () => {
    expect(repsNumber('8-10')).toBe(8);
    expect(repsNumber('12')).toBe(12);
    expect(repsNumber('AMRAP')).toBe(0);
  });

  it('falls back to 4 sets for invalid or non-positive input', () => {
    expect(setsNumber('4')).toBe(4);
    expect(setsNumber('3')).toBe(3);
    expect(setsNumber('0')).toBe(4);
    expect(setsNumber('')).toBe(4);
    expect(setsNumber('abc')).toBe(4);
  });
});
