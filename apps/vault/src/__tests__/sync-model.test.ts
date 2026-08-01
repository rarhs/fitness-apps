import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSessionRecord, type LoggedSet, type SessionMovement } from '../session-math';
import { activeRoutine, defaults, loadPersisted, mutations } from '../state';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MOVEMENTS: SessionMovement[] = [{ id: '0025', bodyPart: 'chest', setCount: 4 }];
const LOGS: Record<number, LoggedSet[]> = { 0: [{ reps: 10, load: 80 }] };

function record(id?: string) {
  return buildSessionRecord({
    movements: MOVEMENTS,
    logs: LOGS,
    unit: 'kg',
    name: 'Push A',
    startMs: 0,
    endMs: 60_000,
    ...(id !== undefined ? { id } : {}),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session identity', () => {
  it('assigns every session a fresh UUID', () => {
    const a = record();
    const b = record();
    expect(a.id).toMatch(UUID_RE);
    expect(b.id).toMatch(UUID_RE);
    expect(a.id).not.toBe(b.id);
  });

  it('honors an explicitly provided id', () => {
    expect(record('fixed-id').id).toBe('fixed-id');
  });
});

describe('legacy history migration', () => {
  it('assigns ids to persisted sessions that predate the id field', () => {
    const legacy = {
      history: [
        { date: '2026-07-01T10:00:00.000Z', name: 'Push A', durationSec: 3000, volumeKg: 1000, setCount: 20, exerciseIds: ['0025'], regions: { chest: 20 } },
        { date: '2026-07-03T10:00:00.000Z', name: 'Pull A', durationSec: 3200, volumeKg: 1200, setCount: 18, exerciseIds: ['0027'], regions: { back: 18 } },
      ],
    };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(legacy), setItem: () => {} });
    const state = loadPersisted();
    expect(state.history).toHaveLength(2);
    for (const h of state.history) expect(h.id).toMatch(UUID_RE);
    expect(new Set(state.history.map((h) => h.id)).size).toBe(2);
  });

  it('keeps ids that already exist', () => {
    const stored = {
      history: [
        { id: 'keep-me', date: '2026-07-01T10:00:00.000Z', name: 'Push A', durationSec: 3000, volumeKg: 1000, setCount: 20, exerciseIds: ['0025'], regions: { chest: 20 } },
      ],
    };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(stored), setItem: () => {} });
    expect(loadPersisted().history[0]!.id).toBe('keep-me');
  });
});

describe('last-write-wins stamps', () => {
  const base = defaults();

  it('starts untouched: defaults carry no updatedAt', () => {
    expect(activeRoutine(base).updatedAt).toBeUndefined();
    expect(base.profile.updatedAt).toBeUndefined();
  });

  it('stamps the routine on add, remove and edit', () => {
    expect(activeRoutine(mutations.addToRoutine(base, '0001', 1234)).updatedAt).toBe(1234);
    expect(activeRoutine(mutations.removeFromRoutine(base, '0025', 2345)).updatedAt).toBe(2345);
    expect(activeRoutine(mutations.setRoutine(base, (r) => ({ ...r, restSec: 120 }), 3456)).updatedAt).toBe(3456);
  });

  it('does not stamp on a no-op duplicate add', () => {
    const once = mutations.addToRoutine(base, '0001', 1000);
    expect(mutations.addToRoutine(once, '0001', 2000)).toBe(once);
    expect(activeRoutine(once).updatedAt).toBe(1000);
  });

  it('stamps the profile on edit', () => {
    const next = mutations.setProfile(base, { units: 'lb' }, 99);
    expect(next.profile.updatedAt).toBe(99);
    expect(next.profile.units).toBe('lb');
  });

  it('leaves sessions and saved unstamped — they merge without timestamps', () => {
    const next = mutations.toggleSaved(base, '0001');
    expect(activeRoutine(next).updatedAt).toBeUndefined();
    expect(next.profile.updatedAt).toBeUndefined();
  });
});
