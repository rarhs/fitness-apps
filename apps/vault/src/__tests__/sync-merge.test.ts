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

/** Full collection semantics: union by id with per-id LWW (tombstones
 * participate like any edit; ties go to remote), touched local-only routines
 * pushed, untouched local seeds discarded once the remote contributes,
 * remote-only routines adopted. */
describe('routine collection merge', () => {
  const nil = (over: Partial<Routine> = {}): Routine => ({ ...defaults().routines[0]!, ...over });
  const mine = (over: Partial<Routine> = {}): Routine =>
    ({ id: 'r-mine', name: 'Pull day', restSec: 60, items: [], updatedAt: 50, ...over });
  const theirs = (over: Partial<Routine> = {}): Routine =>
    ({ id: 'r-theirs', name: 'Leg day', restSec: 120, items: [], updatedAt: 60, ...over });

  it('unions by id: touched local-only pushed, remote-only adopted', () => {
    const l = local({ routines: [nil({ updatedAt: 500 }), mine()] });
    const { merged, push } = mergeStates(
      l,
      remote({ routines: [nil({ name: 'Server', updatedAt: 400 }), theirs()] }),
    );
    expect(merged.routines.map((r) => r.id)).toEqual([SEED_ROUTINE_ID, 'r-mine', 'r-theirs']);
    expect(merged.routines[0]!.updatedAt).toBe(500);
    expect(push.routines.map((r) => r.id)).toEqual([SEED_ROUTINE_ID, 'r-mine']);
  });

  it('per-id LWW: newer remote wins without a push, ties go to remote', () => {
    const l = local({ routines: [nil({ updatedAt: 500 }), mine({ updatedAt: 100 })] });
    const r = remote({
      routines: [nil({ name: 'Server', updatedAt: 500 }), mine({ name: 'Their pull', updatedAt: 200 })],
    });
    const { merged, push } = mergeStates(l, r);
    expect(merged.routines.find((x) => x.id === SEED_ROUTINE_ID)?.name).toBe('Server');
    expect(merged.routines.find((x) => x.id === 'r-mine')?.name).toBe('Their pull');
    expect(push.routines).toEqual([]);
  });

  it('a newer local deletion wins and is pushed as a tombstone', () => {
    const l = local({ routines: [nil({ updatedAt: 1 }), mine({ updatedAt: 300, deletedAt: 300 })] });
    const r = remote({ routines: [mine({ updatedAt: 200 })] });
    const { merged, push } = mergeStates(l, r);
    expect(merged.routines.find((x) => x.id === 'r-mine')?.deletedAt).toBe(300);
    expect(push.routines.map((x) => x.id)).toEqual([SEED_ROUTINE_ID, 'r-mine']);
  });

  it('a newer remote edit revives a locally deleted routine', () => {
    const l = local({ routines: [nil({ updatedAt: 1 }), mine({ updatedAt: 300, deletedAt: 300 })] });
    const r = remote({ routines: [mine({ name: 'Revived', updatedAt: 400 })] });
    const { merged } = mergeStates(l, r);
    expect(merged.routines.find((x) => x.id === 'r-mine')).toEqual(
      mine({ name: 'Revived', updatedAt: 400 }),
    );
  });

  it('a remote tombstone kills an older local edit and re-targets the active id', () => {
    const l = local({
      routines: [nil({ updatedAt: 1 }), mine({ updatedAt: 100 })],
      activeRoutineId: 'r-mine',
    });
    const r = remote({ routines: [mine({ updatedAt: 200, deletedAt: 200 })] });
    const { merged, push } = mergeStates(l, r);
    expect(merged.routines.find((x) => x.id === 'r-mine')?.deletedAt).toBe(200);
    expect(merged.activeRoutineId).toBe(SEED_ROUTINE_ID);
    expect(push.routines.map((x) => x.id)).toEqual([SEED_ROUTINE_ID]);
  });

  it('discards an untouched local seed when the remote contributes routines', () => {
    const { merged, push } = mergeStates(local(), remote({ routines: [theirs()] }));
    expect(merged.routines.map((r) => r.id)).toEqual(['r-theirs']);
    expect(merged.activeRoutineId).toBe('r-theirs');
    expect(push.routines).toEqual([]);
  });

  it('re-seeds a live routine when the remote tombstones every local one', () => {
    const l = local({ routines: [nil({ updatedAt: 1 })] });
    const r = remote({ routines: [nil({ updatedAt: 2, deletedAt: 2 })] });
    const { merged, push } = mergeStates(l, r);
    const live = merged.routines.filter((x) => !x.deletedAt);
    expect(live).toHaveLength(1);
    expect(live[0]!.name).toBe('Starter Push');
    expect(merged.activeRoutineId).toBe(live[0]!.id);
    expect(merged.routines.find((x) => x.id === SEED_ROUTINE_ID)?.deletedAt).toBe(2);
    expect(push.routines).toEqual([]);
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
