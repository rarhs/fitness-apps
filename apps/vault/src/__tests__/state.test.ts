import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaults, initials, loadPersisted, mutations, type SessionRecord } from '../state';

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
    expect(loadPersisted().routine.name).toBe('Push A');
    stubStorage('"just a string"');
    expect(loadPersisted().routine.name).toBe('Push A');
    stubStorage('[1,2,3]');
    expect(loadPersisted().routine.name).toBe('Push A');
  });

  it('merges a partial (older-version) payload over the defaults', () => {
    stubStorage(JSON.stringify({ recents: ['0001'] }));
    const state = loadPersisted();
    expect(state.recents).toEqual(['0001']);
    expect(state.routine.items).toHaveLength(6);
    expect(state.prefs).toEqual([true, false, true, true]);
  });

  it('survives a storage layer that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadPersisted().routine.name).toBe('Push A');
  });
});

describe('mutations', () => {
  const base = defaults();

  it('addToRoutine appends with default sets/reps and dedupes by reference', () => {
    const next = mutations.addToRoutine(base, '0001');
    expect(next.routine.items.at(-1)).toEqual({ id: '0001', sets: '4', reps: '8-10' });
    expect(mutations.addToRoutine(next, '0001')).toBe(next);
  });

  it('removeFromRoutine drops only the matching item', () => {
    const next = mutations.removeFromRoutine(base, '0025');
    expect(next.routine.items.map((i) => i.id)).not.toContain('0025');
    expect(next.routine.items).toHaveLength(base.routine.items.length - 1);
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
      date: '2026-07-31T10:00:00.000Z',
      name: 'Push A',
      durationSec: 3000,
      volumeKg: 1680,
      setCount: 3,
      exerciseIds: ['0025'],
      regions: { chest: 3 },
    };
    const next = mutations.addSession(mutations.addSession(base, { ...rec, name: 'older' }), rec);
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

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Rowan Delacroix')).toBe('RD');
    expect(initials('Guest')).toBe('G');
    expect(initials('ana maria luisa')).toBe('AM');
    expect(initials('   ')).toBe('V');
  });
});
