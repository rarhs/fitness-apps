/** Contract tests for SupabaseBackend against a REAL local Supabase stack —
 * real PostgREST, real RLS, throwaway users. Nothing here is mocked.
 *
 * Run `npx supabase start` in apps/vault, then execute with the local stack's
 * credentials (see supabase/README.md):
 *   SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY
 * Without those env vars the whole suite is skipped (CI runs without Docker).
 * Never point these at the production project.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { SEED_ROUTINE_ID, type SessionRecord } from '../state';
import { SupabaseBackend } from '../sync/supabase-backend';

const URL = process.env.SUPABASE_TEST_URL;
const KEY = process.env.SUPABASE_TEST_ANON_KEY;

const EMPTY = { sessions: [], routine: null, profile: null, saved: [] };

function session(id: string, date: string): SessionRecord {
  return {
    id,
    date,
    name: 'Push A',
    durationSec: 3000,
    volumeKg: 1680,
    setCount: 23,
    exerciseIds: ['0025', '0047'],
    regions: { chest: 12, shoulders: 11 },
    sets: [
      [
        { reps: 10, loadKg: 80 },
        { reps: 8, loadKg: 77.5 },
      ],
      [{ reps: 12, loadKg: 0 }],
    ],
  };
}

async function throwawayUser(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(URL!, KEY!, { auth: { persistSession: false } });
  const email = `contract-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: crypto.randomUUID() });
  if (error || !data.user) throw new Error(`local signUp failed: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!URL || !KEY)('SupabaseBackend contract (local stack)', () => {
  let backend: SupabaseBackend;

  beforeAll(async () => {
    const { client, userId } = await throwawayUser();
    backend = new SupabaseBackend(client, userId);
  }, 30_000);

  it('reads an empty state for a fresh user', async () => {
    expect(await backend.fetchState()).toEqual(EMPTY);
  }, 15_000);

  it('round-trips profile, routine, saved and sessions', async () => {
    const profile = {
      name: 'Rowan',
      email: 'rowan@example.com',
      units: 'lb' as const,
      defaultRestSec: 120,
      memberSince: '2026-07-31T07:00:00.000Z',
      updatedAt: 1753960000000,
    };
    const routine = {
      id: SEED_ROUTINE_ID,
      name: 'Push A',
      restSec: 90,
      items: [{ id: '0025', sets: '4', reps: '8-10' }],
      updatedAt: 1753960000000,
    };
    // Fresh ids every run: sessions.id is a global primary key and pushes are
    // ON CONFLICT DO NOTHING, so a reused id from an earlier run's throwaway
    // user would silently swallow the insert.
    const older = session(crypto.randomUUID(), '2026-07-29T10:00:00.000Z');
    const newer = session(crypto.randomUUID(), '2026-07-31T10:00:00.000Z');

    await backend.putProfile(profile);
    await backend.putRoutine(routine);
    await backend.putSaved(['0025', '0334']);
    await backend.pushSessions([older, newer]);

    const state = await backend.fetchState();
    expect(state.profile).toEqual(profile);
    expect(state.routine).toEqual(routine);
    expect([...state.saved].sort()).toEqual(['0025', '0334']);
    expect(state.sessions).toEqual([newer, older]); // newest first
  }, 15_000);

  it('treats session pushes as append-only and idempotent', async () => {
    const original = session(crypto.randomUUID(), '2026-07-30T10:00:00.000Z');
    await backend.pushSessions([original]);
    // Same id, different content: must be ignored, never rewritten.
    await backend.pushSessions([{ ...original, name: 'rewritten', volumeKg: 1 }]);

    const state = await backend.fetchState();
    const stored = state.sessions.find((s) => s.id === original.id);
    expect(stored).toEqual(original);
  }, 15_000);

  it('updates the routine in place on re-put', async () => {
    await backend.putRoutine({ id: SEED_ROUTINE_ID, name: 'Push A', restSec: 90, items: [], updatedAt: 1 });
    await backend.putRoutine({ id: SEED_ROUTINE_ID, name: 'Push B', restSec: 60, items: [], updatedAt: 2 });
    const state = await backend.fetchState();
    expect(state.routine?.name).toBe('Push B');
    expect(state.routine?.restSec).toBe(60);
  }, 15_000);

  it('makes the saved set equal to the given list', async () => {
    await backend.putSaved(['a1', 'b2']);
    await backend.putSaved(['b2', 'c3']);
    const afterSwap = await backend.fetchState();
    expect([...afterSwap.saved].sort()).toEqual(['b2', 'c3']);

    await backend.putSaved([]);
    const afterClear = await backend.fetchState();
    expect(afterClear.saved).toEqual([]);
  }, 15_000);

  it('isolates users: a second account sees none of the first user’s data', async () => {
    const { client, userId } = await throwawayUser();
    const other = new SupabaseBackend(client, userId);
    expect(await other.fetchState()).toEqual(EMPTY);
  }, 30_000);
});
