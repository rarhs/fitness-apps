/** The wiring between app state and the sync engine: deriving SyncOps from a
 * state transition, turning a merge's push plan into ops, and the
 * SyncController that orchestrates fetch → merge → plan → queue → flush.
 * Framework-free — the React SyncProvider is a thin adapter over this. */
import { describe, expect, it } from 'vitest';
import { defaults, mutations, type Persisted, type SessionRecord } from '../state';
import { SyncController } from '../sync/controller';
import { FakeBackend } from '../sync/fake-backend';
import { opsForTransition, planOps } from '../sync/ops';
import { SyncQueue } from '../sync/queue';

const session = (id: string, date: string): SessionRecord => ({
  id,
  date,
  name: 'Push A',
  durationSec: 3000,
  volumeKg: 1680,
  setCount: 23,
  exerciseIds: ['0025'],
  regions: { chest: 12 },
});

const S1 = session('11111111-0000-4000-8000-000000000001', '2026-07-29T10:00:00.000Z');
const S2 = session('22222222-0000-4000-8000-000000000002', '2026-07-31T10:00:00.000Z');

describe('state mutations for sync', () => {
  it('hydrate replaces the state with the merged object as-is', () => {
    const merged = { ...defaults(), saved: ['0025'] };
    expect(mutations.hydrate(defaults(), merged)).toBe(merged);
  });

  it('seedProfile merges a patch without stamping updatedAt', () => {
    const next = mutations.seedProfile(defaults(), { name: 'Rowan', email: 'r@example.com' });
    expect(next.profile.name).toBe('Rowan');
    expect(next.profile.email).toBe('r@example.com');
    expect(next.profile.updatedAt).toBeUndefined();
  });

  it('seedProfile keeps an existing stamp untouched', () => {
    const touched = mutations.setProfile(defaults(), { units: 'lb' }, 1753960000000);
    const next = mutations.seedProfile(touched, { name: 'Rowan' });
    expect(next.profile.updatedAt).toBe(1753960000000);
    expect(next.profile.units).toBe('lb');
  });
});

describe('opsForTransition', () => {
  it('returns nothing for an identical state', () => {
    const d = defaults();
    expect(opsForTransition(d, d)).toEqual([]);
    expect(opsForTransition(d, { ...d })).toEqual([]);
  });

  it('pushes a newly logged session', () => {
    const prev = defaults();
    const next = mutations.addSession(prev, S1);
    expect(opsForTransition(prev, next)).toEqual([{ kind: 'push-session', session: S1 }]);
  });

  it('pushes multiple new sessions oldest-first', () => {
    const prev = defaults();
    const next = mutations.addSession(mutations.addSession(prev, S1), S2);
    expect(opsForTransition(prev, next)).toEqual([
      { kind: 'push-session', session: S1 },
      { kind: 'push-session', session: S2 },
    ]);
  });

  it('puts the routine when it changed', () => {
    const prev = defaults();
    const next = mutations.setRoutine(prev, (r) => ({ ...r, restSec: 120 }), 1753960000000);
    expect(opsForTransition(prev, next)).toEqual([{ kind: 'put-routine', routine: next.routine }]);
  });

  it('puts the profile when it changed', () => {
    const prev = defaults();
    const next = mutations.setProfile(prev, { units: 'lb' }, 1753960000000);
    expect(opsForTransition(prev, next)).toEqual([{ kind: 'put-profile', profile: next.profile }]);
  });

  it('puts the saved set when it changed', () => {
    const prev = defaults();
    const next = mutations.toggleSaved(prev, '0025');
    expect(opsForTransition(prev, next)).toEqual([{ kind: 'put-saved', saved: ['0025'] }]);
  });

  it('ignores device-local recents and prefs', () => {
    const prev = defaults();
    const next = mutations.togglePref(mutations.pushRecent(prev, '0025'), 0);
    expect(opsForTransition(prev, next)).toEqual([]);
  });
});

describe('planOps', () => {
  it('returns nothing for an empty plan', () => {
    const merged = defaults();
    expect(planOps(merged, { sessions: [], routine: false, profile: false, saved: false })).toEqual([]);
  });

  it('maps the plan to ops carrying the merged documents', () => {
    const merged: Persisted = {
      ...defaults(),
      history: [S2, S1],
      saved: ['0025'],
    };
    expect(planOps(merged, { sessions: [S1, S2], routine: true, profile: true, saved: true })).toEqual([
      { kind: 'push-session', session: S1 },
      { kind: 'push-session', session: S2 },
      { kind: 'put-routine', routine: merged.routine },
      { kind: 'put-profile', profile: merged.profile },
      { kind: 'put-saved', saved: ['0025'] },
    ]);
  });
});

describe('SyncController', () => {
  it('start on a fresh account with untouched local defaults writes nothing', async () => {
    const backend = new FakeBackend();
    const ctl = new SyncController(backend);
    const local = defaults();
    const merged = await ctl.start(() => local);
    expect(merged.history).toEqual([]);
    expect(backend.calls).toEqual(['fetchState']);
    expect(ctl.pending()).toBe(0);
  });

  it('start adopts existing local data into an empty account', async () => {
    const backend = new FakeBackend();
    const ctl = new SyncController(backend);
    const local = mutations.addSession(mutations.toggleSaved(defaults(), '0025'), S1);
    await ctl.start(() => local);
    expect(backend.state.sessions).toEqual([S1]);
    expect(backend.state.saved).toEqual(['0025']);
    expect(ctl.pending()).toBe(0);
  });

  it('start pulls remote data onto a fresh device without writing', async () => {
    const backend = new FakeBackend();
    backend.state = {
      sessions: [S2],
      routine: null,
      profile: null,
      saved: ['0814'],
    };
    const ctl = new SyncController(backend);
    const merged = await ctl.start(() => defaults());
    expect(merged.history).toEqual([S2]);
    expect(merged.saved).toEqual(['0814']);
    expect(backend.calls).toEqual(['fetchState']);
  });

  it('onChange pushes what changed since the last synced state', async () => {
    const backend = new FakeBackend();
    const ctl = new SyncController(backend);
    const local = defaults();
    const merged = await ctl.start(() => local);
    const next = mutations.addSession(merged, S1);
    await ctl.onChange(next);
    expect(backend.state.sessions).toEqual([S1]);
    // Re-notifying the same state is a no-op.
    await ctl.onChange(next);
    expect(backend.calls.filter((c) => c === 'pushSessions')).toHaveLength(1);
  });

  it('buffers writes while the backend is down and drains on flush', async () => {
    const backend = new FakeBackend();
    backend.failOnCalls = [2]; // call 1 = start's fetchState, call 2 = the push
    const ctl = new SyncController(backend);
    const merged = await ctl.start(() => defaults());
    await ctl.onChange(mutations.addSession(merged, S1));
    expect(ctl.pending()).toBe(1);
    expect(backend.state.sessions).toEqual([]);
    await ctl.flush();
    expect(ctl.pending()).toBe(0);
    expect(backend.state.sessions).toEqual([S1]);
  });

  it('onChange before start is a safe no-op', async () => {
    const backend = new FakeBackend();
    const ctl = new SyncController(backend);
    await ctl.onChange(mutations.addSession(defaults(), S1));
    expect(backend.calls).toEqual([]);
    expect(ctl.pending()).toBe(0);
  });

  it('flushes a queue persisted from an earlier visit during start', async () => {
    const queue = new SyncQueue();
    queue.enqueue({ kind: 'put-saved', saved: ['0025'] });
    const revived = SyncQueue.deserialize(queue.serialize());
    const backend = new FakeBackend();
    const ctl = new SyncController(backend, revived);
    await ctl.start(() => defaults());
    expect(backend.state.saved).toEqual(['0025']);
    expect(ctl.pending()).toBe(0);
  });

  it('serializeQueue exposes the buffered ops for persistence', async () => {
    const backend = new FakeBackend();
    backend.failOnCalls = [2];
    const ctl = new SyncController(backend);
    const merged = await ctl.start(() => defaults());
    await ctl.onChange(mutations.addSession(merged, S1));
    const ops = SyncQueue.deserialize(ctl.serializeQueue()).ops();
    expect(ops).toEqual([{ kind: 'push-session', session: S1 }]);
  });
});
