import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeRoutine,
  defaults,
  initials,
  liveRoutines,
  loadPersisted,
  mutations,
  SEED_ROUTINE_ID,
  uniqueName,
  type SessionRecord,
} from '../state';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function stubStorage(raw: string | null) {
  vi.stubGlobal('localStorage', {
    getItem: () => raw,
    setItem: () => {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadPersisted', () => {
  it('returns defaults when nothing is stored', () => {
    stubStorage(null);
    const state = loadPersisted();
    const base = defaults();
    // memberSince is stamped with the current time on both sides — compare
    // everything else, then only check it is a valid timestamp.
    expect({ ...state, profile: { ...state.profile, memberSince: '' } }).toEqual({
      ...base,
      profile: { ...base.profile, memberSince: '' },
    });
    expect(new Date(state.profile.memberSince).getTime()).not.toBeNaN();
  });

  it('survives malformed JSON and non-object payloads', () => {
    stubStorage('{not json');
    expect(activeRoutine(loadPersisted()).name).toBe('Starter Push');
    stubStorage('"just a string"');
    expect(activeRoutine(loadPersisted()).name).toBe('Starter Push');
    stubStorage('[1,2,3]');
    expect(activeRoutine(loadPersisted()).name).toBe('Starter Push');
  });

  it('merges a partial (older-version) payload over the defaults', () => {
    stubStorage(JSON.stringify({ recents: ['0001'] }));
    const state = loadPersisted();
    expect(state.recents).toEqual(['0001']);
    expect(activeRoutine(state).items).toHaveLength(6);
    expect(state.prefs).toEqual([true, false, true, true]);
  });

  it('survives a storage layer that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(activeRoutine(loadPersisted()).name).toBe('Starter Push');
  });
});

describe('mutations', () => {
  const base = defaults();

  it('addToRoutine appends with default sets/reps and dedupes by reference', () => {
    const next = mutations.addToRoutine(base, '0001');
    expect(activeRoutine(next).items.at(-1)).toEqual({ id: '0001', sets: '4', reps: '8-10' });
    expect(mutations.addToRoutine(next, '0001')).toBe(next);
  });

  it('removeFromRoutine drops only the matching item', () => {
    const next = mutations.removeFromRoutine(base, '0025');
    expect(activeRoutine(next).items.map((i) => i.id)).not.toContain('0025');
    expect(activeRoutine(next).items).toHaveLength(activeRoutine(base).items.length - 1);
  });

  it('pushRecent moves to front, dedupes, caps at 10, and no-ops when already first', () => {
    let d = base;
    for (let i = 0; i < 12; i++) d = mutations.pushRecent(d, String(i).padStart(4, '0'));
    expect(d.recents).toHaveLength(10);
    expect(d.recents[0]).toBe('0011');
    expect(mutations.pushRecent(d, '0011')).toBe(d);
    const again = mutations.pushRecent(d, '0005');
    expect(again.recents[0]).toBe('0005');
    expect(again.recents.filter((r) => r === '0005')).toHaveLength(1);
  });

  it('toggleSaved round-trips', () => {
    const on = mutations.toggleSaved(base, '0001');
    expect(on.saved).toContain('0001');
    const off = mutations.toggleSaved(on, '0001');
    expect(off.saved).not.toContain('0001');
  });

  it('addSession prepends newest first', () => {
    const rec: SessionRecord = {
      id: 's-new',
      date: '2026-07-31T10:00:00.000Z',
      name: 'Push A',
      durationSec: 3000,
      volumeKg: 1680,
      setCount: 3,
      exerciseIds: ['0025'],
      regions: { chest: 3 },
    };
    const next = mutations.addSession(
      mutations.addSession(base, { ...rec, id: 's-old', name: 'older' }),
      rec,
    );
    expect(next.history.map((h) => h.name)).toEqual(['Push A', 'older']);
  });

  it('togglePref flips only the given index', () => {
    const next = mutations.togglePref(base, 1);
    expect(next.prefs).toEqual([true, true, true, true]);
    expect(mutations.togglePref(next, 1).prefs).toEqual(base.prefs);
  });

  it('setProfile patches without clobbering other fields', () => {
    const next = mutations.setProfile(base, { units: 'lb' });
    expect(next.profile.units).toBe('lb');
    expect(next.profile.name).toBe(base.profile.name);
  });
});

describe('routine collection', () => {
  it('seeds one Starter Push routine under the nil id', () => {
    const d = defaults();
    expect(d.routines).toHaveLength(1);
    expect(d.routines[0]).toMatchObject({ id: SEED_ROUTINE_ID, name: 'Starter Push' });
    expect(d.activeRoutineId).toBe(SEED_ROUTINE_ID);
    expect(activeRoutine(d)).toBe(d.routines[0]);
    expect(liveRoutines(d)).toEqual(d.routines);
  });

  it('migrates a legacy single-routine payload under the nil id and activates it', () => {
    const legacy = {
      name: 'Push A',
      restSec: 120,
      items: [{ id: '0025', sets: '4', reps: '8-10' }],
      updatedAt: 777,
    };
    stubStorage(JSON.stringify({ routine: legacy }));
    const state = loadPersisted();
    expect(state.routines).toEqual([{ ...legacy, id: SEED_ROUTINE_ID }]);
    expect(state.activeRoutineId).toBe(SEED_ROUTINE_ID);
    expect('routine' in state).toBe(false);
  });

  it('keeps a stored multi-routine shape as-is', () => {
    const stored = {
      routines: [
        { id: SEED_ROUTINE_ID, name: 'Starter Push', restSec: 90, items: [] },
        { id: 'r2', name: 'Pull day', restSec: 60, items: [], updatedAt: 5 },
      ],
      activeRoutineId: 'r2',
    };
    stubStorage(JSON.stringify(stored));
    const state = loadPersisted();
    expect(state.routines).toEqual(stored.routines);
    expect(state.activeRoutineId).toBe('r2');
  });

  it('assigns ids to stored routines that lack one', () => {
    stubStorage(JSON.stringify({ routines: [{ name: 'No id', restSec: 90, items: [] }] }));
    expect(loadPersisted().routines[0]!.id).toMatch(UUID_RE);
  });

  it('re-targets a dangling or tombstoned activeRoutineId to the first live routine', () => {
    stubStorage(
      JSON.stringify({
        routines: [
          { id: 'dead', name: 'Old', restSec: 90, items: [], updatedAt: 1, deletedAt: 1 },
          { id: 'live', name: 'Current', restSec: 90, items: [] },
        ],
        activeRoutineId: 'dead',
      }),
    );
    expect(loadPersisted().activeRoutineId).toBe('live');
  });

  it('re-seeds when no live routine survives, keeping the tombstones', () => {
    stubStorage(
      JSON.stringify({
        routines: [{ id: 'dead', name: 'Old', restSec: 90, items: [], updatedAt: 1, deletedAt: 1 }],
        activeRoutineId: 'dead',
      }),
    );
    const state = loadPersisted();
    const live = liveRoutines(state);
    expect(live).toHaveLength(1);
    expect(live[0]!.name).toBe('Starter Push');
    expect(state.activeRoutineId).toBe(live[0]!.id);
    expect(state.routines).toHaveLength(2);
  });

  it('addRoutine appends an empty routine, names it uniquely and activates it', () => {
    const base = defaults();
    const one = mutations.addRoutine(base, 100, 'r-a');
    expect(one.routines).toHaveLength(2);
    expect(one.activeRoutineId).toBe('r-a');
    expect(activeRoutine(one)).toEqual({
      id: 'r-a',
      name: 'New routine',
      restSec: base.profile.defaultRestSec,
      items: [],
      updatedAt: 100,
    });
    const two = mutations.addRoutine(one, 200, 'r-b');
    expect(activeRoutine(two).name).toBe('New routine 2');
  });

  it('duplicateRoutine copies items and settings under a fresh id', () => {
    const base = defaults();
    const next = mutations.duplicateRoutine(base, SEED_ROUTINE_ID, 100, 'copy-1');
    expect(next.routines).toHaveLength(2);
    expect(next.activeRoutineId).toBe('copy-1');
    expect(activeRoutine(next)).toEqual({
      ...base.routines[0]!,
      id: 'copy-1',
      name: 'Starter Push copy',
      updatedAt: 100,
    });
  });

  it('duplicateRoutine no-ops on a missing or tombstoned source', () => {
    const base = defaults();
    expect(mutations.duplicateRoutine(base, 'nope', 100, 'x')).toBe(base);
    const dead = mutations.deleteRoutine(mutations.addRoutine(base, 1, 'r-a'), 'r-a', 2);
    expect(mutations.duplicateRoutine(dead, 'r-a', 100, 'x')).toBe(dead);
  });

  it('deleteRoutine tombstones, keeps the record and re-targets the active id', () => {
    const two = mutations.addRoutine(defaults(), 100, 'r-a');
    const next = mutations.deleteRoutine(two, 'r-a', 200);
    expect(next.routines).toHaveLength(2);
    expect(next.routines.find((r) => r.id === 'r-a')).toMatchObject({
      deletedAt: 200,
      updatedAt: 200,
    });
    expect(next.activeRoutineId).toBe(SEED_ROUTINE_ID);
    expect(liveRoutines(next).map((r) => r.id)).toEqual([SEED_ROUTINE_ID]);
  });

  it('deleteRoutine refuses to remove the last live routine', () => {
    const base = defaults();
    expect(mutations.deleteRoutine(base, SEED_ROUTINE_ID, 100)).toBe(base);
  });

  it('deleteRoutine no-ops on missing or already dead ids', () => {
    const two = mutations.addRoutine(defaults(), 1, 'r-a');
    expect(mutations.deleteRoutine(two, 'nope', 2)).toBe(two);
    const dead = mutations.deleteRoutine(two, 'r-a', 2);
    expect(mutations.deleteRoutine(dead, 'r-a', 3)).toBe(dead);
  });

  it('selectRoutine switches only to live routines without stamping updatedAt', () => {
    const two = mutations.addRoutine(defaults(), 100, 'r-a');
    const back = mutations.selectRoutine(two, SEED_ROUTINE_ID);
    expect(back.activeRoutineId).toBe(SEED_ROUTINE_ID);
    expect(back.routines).toBe(two.routines);
    expect(mutations.selectRoutine(back, 'nope')).toBe(back);
    const dead = mutations.deleteRoutine(two, 'r-a', 200);
    expect(mutations.selectRoutine(dead, 'r-a')).toBe(dead);
  });

  it('edit mutations touch only the active routine', () => {
    const two = mutations.addRoutine(defaults(), 100, 'r-a');
    const seedBefore = two.routines.find((r) => r.id === SEED_ROUTINE_ID);
    const withItem = mutations.addToRoutine(two, '0001', 200);
    expect(activeRoutine(withItem).items).toEqual([{ id: '0001', sets: '4', reps: '8-10' }]);
    expect(withItem.routines.find((r) => r.id === SEED_ROUTINE_ID)).toBe(seedBefore);
    const renamed = mutations.setRoutine(withItem, (r) => ({ ...r, name: 'Pull day' }), 300);
    expect(activeRoutine(renamed)).toMatchObject({ id: 'r-a', name: 'Pull day', updatedAt: 300 });
  });
});

describe('uniqueName', () => {
  it('returns the base when free and appends a counter from 2', () => {
    expect(uniqueName('New routine', [])).toBe('New routine');
    expect(uniqueName('New routine', ['New routine'])).toBe('New routine 2');
    expect(uniqueName('New routine', ['New routine', 'New routine 2'])).toBe('New routine 3');
  });
});

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Rowan Delacroix')).toBe('RD');
    expect(initials('Guest')).toBe('G');
    expect(initials('ana maria luisa')).toBe('AM');
    expect(initials('   ')).toBe('V');
  });
});
