import { describe, expect, it } from 'vitest';
import { activeRoutine, defaults, SEED_ROUTINE_ID, type Persisted, type Routine, type SessionRecord } from '../state';
import { mergeStates } from '../sync/merge';
import type { RemoteState } from '../sync/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 31, 12, 0, 0);

function session(id: string, daysAgo: number): SessionRecord {
  return {
    id,
    date: new Date(NOW - daysAgo * DAY_MS).toISOString(),
    name: 'Push A',
    durationSec: 3000,
    volumeKg: 1000,
    setCount: 20,
    exerciseIds: ['0025'],
    regions: { chest: 20 },
  };
}

function remote(partial: Partial<RemoteState> = {}): RemoteState {
  return { sessions: [], routine: null, profile: null, saved: [], ...partial };
}

function local(partial: Partial<Persisted> = {}): Persisted {
  return { ...defaults(), ...partial };
}

const NO_PUSH = { sessions: [], routine: false, profile: false, saved: false };

describe('first sign-in', () => {
  it('untouched local + empty remote: keep local, push nothing', () => {
    const l = local();
    const { merged, push } = mergeStates(l, remote());
    expect(merged).toEqual(l);
    expect(push).toEqual(NO_PUSH);
  });

  it('adopts existing local data into an empty account', () => {
    const l = local({
      history: [session('a', 1), session('b', 3)],
      routines: [{ ...defaults().routines[0]!, restSec: 120, updatedAt: 5000 }],
      profile: { ...defaults().profile, name: 'Rowan', updatedAt: 6000 },
      saved: ['0025', '0334'],
    });
    const { merged, push } = mergeStates(l, remote());
    expect(merged.history.map((h) => h.id)).toEqual(['a', 'b']);
    expect(activeRoutine(merged).restSec).toBe(120);
    expect(push.sessions.map((s) => s.id)).toEqual(['a', 'b']);
    expect(push.routine).toBe(true);
    expect(push.profile).toBe(true);
    expect(push.saved).toBe(true);
  });

  it('adopts remote data onto a fresh device, pushing nothing', () => {
    const r = remote({
      sessions: [session('r1', 2)],
      routine: { id: SEED_ROUTINE_ID, name: 'Pull B', restSec: 60, items: [], updatedAt: 100 },
      profile: { name: 'Rowan', email: 'r@x.com', units: 'lb', defaultRestSec: 60, memberSince: '2024-01-01T00:00:00.000Z', updatedAt: 100 },
      saved: ['0027'],
    });
    const l = local({ recents: ['0001'], prefs: [false, false, false, false] });
    const { merged, push } = mergeStates(l, r);
    expect(merged.history.map((h) => h.id)).toEqual(['r1']);
    expect(activeRoutine(merged).name).toBe('Pull B');
    expect(merged.profile.name).toBe('Rowan');
    expect(merged.saved).toEqual(['0027']);
    expect(push).toEqual(NO_PUSH);
    // device-local slices are never merged
    expect(merged.recents).toEqual(['0001']);
    expect(merged.prefs).toEqual([false, false, false, false]);
  });
});

describe('session union', () => {
  it('unions by id without duplicates, newest first, pushing only local-only sessions', () => {
    const shared = session('shared', 5);
    const l = local({ history: [session('local-new', 1), shared] });
    const r = remote({ sessions: [shared, session('remote-old', 9)] });
    const { merged, push } = mergeStates(l, r);
    expect(merged.history.map((h) => h.id)).toEqual(['local-new', 'shared', 'remote-old']);
    expect(push.sessions.map((s) => s.id)).toEqual(['local-new']);
  });
});

describe('last-write-wins documents', () => {
  const remoteRoutine = { id: SEED_ROUTINE_ID, name: 'Remote', restSec: 60, items: [], updatedAt: 1000 };

  it('newer local routine wins and is pushed', () => {
    const l = local({ routines: [{ ...defaults().routines[0]!, name: 'Local', updatedAt: 2000 }] });
    const { merged, push } = mergeStates(l, remote({ routine: remoteRoutine }));
    expect(activeRoutine(merged).name).toBe('Local');
    expect(push.routine).toBe(true);
  });

  it('newer remote routine wins without a push', () => {
    const l = local({ routines: [{ ...defaults().routines[0]!, name: 'Local', updatedAt: 500 }] });
    const { merged, push } = mergeStates(l, remote({ routine: remoteRoutine }));
    expect(activeRoutine(merged).name).toBe('Remote');
    expect(push.routine).toBe(false);
  });

  it('breaks ties in favor of remote', () => {
    const l = local({ routines: [{ ...defaults().routines[0]!, name: 'Local', updatedAt: 1000 }] });
    const { merged, push } = mergeStates(l, remote({ routine: remoteRoutine }));
    expect(activeRoutine(merged).name).toBe('Remote');
    expect(push.routine).toBe(false);
  });

  it('an untouched local default loses to any remote profile', () => {
    const remoteProfile = { name: 'Rowan', email: 'r@x.com', units: 'lb' as const, defaultRestSec: 60, memberSince: '2024-01-01T00:00:00.000Z', updatedAt: 1 };
    const { merged, push } = mergeStates(local(), remote({ profile: remoteProfile }));
    expect(merged.profile).toEqual(remoteProfile);
    expect(push.profile).toBe(false);
  });
});

/** Until the multi-routine schema lands, the backend stores exactly one
 * routine per user — by the identity convention, the nil-id one. Only that
 * document merges; other local routines stay local-only. */
describe('interim nil-routine bridge', () => {
  const nil = (over: Partial<Routine> = {}): Routine => ({ ...defaults().routines[0]!, ...over });
  const extra: Routine = { id: 'r-local', name: 'Pull day', restSec: 60, items: [], updatedAt: 50 };
  const remoteNil: Routine = { id: SEED_ROUTINE_ID, name: 'Remote', restSec: 60, items: [], updatedAt: 1000 };

  it('merges only the nil routine; other local routines pass through untouched', () => {
    const l = local({ routines: [nil({ updatedAt: 500 }), extra], activeRoutineId: 'r-local' });
    const { merged, push } = mergeStates(l, remote({ routine: remoteNil }));
    expect(merged.routines.find((r) => r.id === SEED_ROUTINE_ID)?.name).toBe('Remote');
    expect(merged.routines.find((r) => r.id === 'r-local')).toEqual(extra);
    expect(merged.activeRoutineId).toBe('r-local');
    expect(push.routine).toBe(false);
  });

  it('pushes a newer local nil routine', () => {
    const l = local({ routines: [nil({ name: 'Mine', updatedAt: 2000 }), extra] });
    const { merged, push } = mergeStates(l, remote({ routine: remoteNil }));
    expect(merged.routines.find((r) => r.id === SEED_ROUTINE_ID)?.name).toBe('Mine');
    expect(push.routine).toBe(true);
  });

  it('keeps a locally deleted nil routine dead and never pushes the tombstone', () => {
    const l = local({
      routines: [nil({ updatedAt: 2000, deletedAt: 2000 }), extra],
      activeRoutineId: 'r-local',
    });
    const { merged, push } = mergeStates(l, remote({ routine: { ...remoteNil, updatedAt: 1000 } }));
    expect(merged.routines.find((r) => r.id === SEED_ROUTINE_ID)?.deletedAt).toBe(2000);
    expect(push.routine).toBe(false);
  });

  it('a strictly newer remote edit revives a locally deleted nil routine', () => {
    const l = local({
      routines: [nil({ updatedAt: 2000, deletedAt: 2000 }), extra],
      activeRoutineId: 'r-local',
    });
    const { merged, push } = mergeStates(l, remote({ routine: { ...remoteNil, updatedAt: 3000 } }));
    expect(merged.routines.find((r) => r.id === SEED_ROUTINE_ID)).toEqual({ ...remoteNil, updatedAt: 3000 });
    expect(push.routine).toBe(false);
  });
});

describe('saved union', () => {
  it('unions local-first and pushes when local contributes', () => {
    const l = local({ saved: ['a', 'b'] });
    const { merged, push } = mergeStates(l, remote({ saved: ['b', 'c'] }));
    expect(merged.saved).toEqual(['a', 'b', 'c']);
    expect(push.saved).toBe(true);
  });

  it('does not push when local is a subset', () => {
    const l = local({ saved: ['b'] });
    const { merged, push } = mergeStates(l, remote({ saved: ['b', 'c'] }));
    expect(merged.saved).toEqual(['b', 'c']);
    expect(push.saved).toBe(false);
  });
});
