import { describe, expect, it } from 'vitest';
import { SEED_ROUTINE_ID, type Profile, type Routine, type SessionRecord } from '../state';
import {
  profileToRow,
  routineToRow,
  rowToProfile,
  rowToRoutine,
  rowToSession,
  sessionToRow,
} from '../sync/rows';

const USER = 'a0000000-0000-4000-8000-00000000000a';

const SESSION: SessionRecord = {
  id: '11111111-0000-4000-8000-000000000001',
  date: '2026-07-31T10:00:00.000Z',
  name: 'Push A',
  durationSec: 3000,
  volumeKg: 1680,
  setCount: 23,
  exerciseIds: ['0025', '0047'],
  regions: { chest: 12, shoulders: 11 },
  sets: [
    [
      { reps: 10, loadKg: 80 },
      { reps: 8, loadKg: 80 },
    ],
    [{ reps: 12, loadKg: 45.36 }],
  ],
};

const ROUTINE: Routine = {
  id: SEED_ROUTINE_ID,
  name: 'Push A',
  restSec: 90,
  items: [{ id: '0025', sets: '4', reps: '8-10' }],
  updatedAt: 1753960000000,
};

const PROFILE: Profile = {
  name: 'Rowan',
  email: 'rowan@example.com',
  units: 'lb',
  defaultRestSec: 120,
  memberSince: '2026-07-31T07:00:00.000Z',
  updatedAt: 1753960000000,
};

describe('session mapping', () => {
  it('round-trips through the row shape', () => {
    expect(rowToSession(sessionToRow(SESSION, USER))).toEqual(SESSION);
  });

  it('stamps user_id on the way out and drops it on the way in', () => {
    const row = sessionToRow(SESSION, USER);
    expect(row.user_id).toBe(USER);
    expect('user_id' in rowToSession(row)).toBe(false);
  });

  it('normalizes postgres timestamptz offsets to ISO Z', () => {
    const row = { ...sessionToRow(SESSION, USER), date: '2026-07-31 10:00:00+00' };
    expect(rowToSession(row).date).toBe('2026-07-31T10:00:00.000Z');
  });

  it('ignores server-side extras like created_at', () => {
    const row = { ...sessionToRow(SESSION, USER), created_at: '2026-07-31T11:00:00Z' };
    expect(rowToSession(row)).toEqual(SESSION);
  });

  it('maps a legacy record without sets to an empty sets column', () => {
    const { sets: _sets, ...legacy } = SESSION;
    expect(sessionToRow(legacy, USER).sets).toEqual([]);
  });

  it('omits sets on the way in when the row carries none', () => {
    const { sets: _sets, ...legacy } = SESSION;
    const roundTripped = rowToSession(sessionToRow(legacy, USER));
    expect('sets' in roundTripped).toBe(false);
    expect(roundTripped).toEqual(legacy);
  });
});

describe('routine mapping', () => {
  it('round-trips through the row shape', () => {
    expect(rowToRoutine(routineToRow(ROUTINE, USER))).toEqual(ROUTINE);
  });

  it('maps the LWW clock: absent updatedAt ↔ 0', () => {
    const untouched: Routine = { id: SEED_ROUTINE_ID, name: 'Push A', restSec: 90, items: [] };
    expect(routineToRow(untouched, USER).updated_at_ms).toBe(0);
    expect(rowToRoutine(routineToRow(untouched, USER)).updatedAt).toBeUndefined();
  });

  it('carries a non-nil id and the tombstone through the row shape', () => {
    const dead: Routine = {
      id: '7d9e4a10-0000-4000-8000-000000000042',
      name: 'Old pull',
      restSec: 60,
      items: [],
      updatedAt: 5,
      deletedAt: 9,
    };
    const row = routineToRow(dead, USER);
    expect(row.id).toBe(dead.id);
    expect(row.deleted_at_ms).toBe(9);
    expect(rowToRoutine(row)).toEqual(dead);
  });

  it('maps the tombstone clock: absent deletedAt ↔ 0', () => {
    const row = routineToRow(ROUTINE, USER);
    expect(row.deleted_at_ms).toBe(0);
    expect('deletedAt' in rowToRoutine(row)).toBe(false);
  });

  it('carries items as-is', () => {
    expect(routineToRow(ROUTINE, USER).items).toEqual(ROUTINE.items);
  });
});

describe('profile mapping', () => {
  it('round-trips through the row shape', () => {
    expect(rowToProfile(profileToRow(PROFILE, USER))).toEqual(PROFILE);
  });

  it('normalizes member_since to ISO Z', () => {
    const row = { ...profileToRow(PROFILE, USER), member_since: '2026-07-31 07:00:00+00' };
    expect(rowToProfile(row).memberSince).toBe('2026-07-31T07:00:00.000Z');
  });

  it('maps the LWW clock: absent updatedAt ↔ 0', () => {
    const untouched: Profile = { ...PROFILE, updatedAt: undefined };
    expect(profileToRow(untouched, USER).updated_at_ms).toBe(0);
    expect(rowToProfile(profileToRow(untouched, USER)).updatedAt).toBeUndefined();
  });
});
