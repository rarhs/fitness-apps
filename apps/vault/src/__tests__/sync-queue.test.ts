import { describe, expect, it } from 'vitest';
import { SEED_ROUTINE_ID, type Routine, type SessionRecord } from '../state';
import { FakeBackend } from '../sync/fake-backend';
import { SyncQueue } from '../sync/queue';

function session(id: string): SessionRecord {
  return {
    id,
    date: '2026-07-31T10:00:00.000Z',
    name: 'Push A',
    durationSec: 3000,
    volumeKg: 1000,
    setCount: 20,
    exerciseIds: ['0025'],
    regions: { chest: 20 },
  };
}

function routine(name: string): Routine {
  return { id: SEED_ROUTINE_ID, name, restSec: 90, items: [], updatedAt: 1 };
}

describe('coalescing', () => {
  it('keeps only the latest document op of each kind, at the back of the queue', () => {
    const q = new SyncQueue();
    q.enqueue({ kind: 'put-routine', routine: routine('v1') });
    q.enqueue({ kind: 'push-session', session: session('s1') });
    q.enqueue({ kind: 'put-routine', routine: routine('v2') });
    expect(q.ops()).toEqual([
      { kind: 'push-session', session: session('s1') },
      { kind: 'put-routine', routine: routine('v2') },
    ]);
  });

  it('accumulates distinct sessions but replaces a re-queued id', () => {
    const q = new SyncQueue();
    q.enqueue({ kind: 'push-session', session: session('a') });
    q.enqueue({ kind: 'push-session', session: session('b') });
    q.enqueue({ kind: 'push-session', session: { ...session('a'), volumeKg: 9 } });
    expect(q.ops().map((op) => (op.kind === 'push-session' ? op.session.id : op.kind))).toEqual(['b', 'a']);
    const first = q.ops().find((op) => op.kind === 'push-session' && op.session.id === 'a');
    expect(first && first.kind === 'push-session' && first.session.volumeKg).toBe(9);
  });
});

describe('flush', () => {
  it('drains FIFO into the backend and empties the queue', async () => {
    const backend = new FakeBackend();
    const q = new SyncQueue();
    q.enqueue({ kind: 'push-session', session: session('a') });
    q.enqueue({ kind: 'put-routine', routine: routine('v1') });
    q.enqueue({ kind: 'put-saved', saved: ['0025'] });

    const result = await q.flush(backend);
    expect(result).toEqual({ flushed: 3, remaining: 0 });
    expect(q.ops()).toEqual([]);
    expect(backend.calls).toEqual(['pushSessions', 'putRoutine', 'putSaved']);
    expect(backend.state.sessions.map((s) => s.id)).toEqual(['a']);
    expect(backend.state.routine?.name).toBe('v1');
    expect(backend.state.saved).toEqual(['0025']);
  });

  it('does not touch the backend when empty', async () => {
    const backend = new FakeBackend();
    const result = await new SyncQueue().flush(backend);
    expect(result).toEqual({ flushed: 0, remaining: 0 });
    expect(backend.calls).toEqual([]);
  });

  it('stops at the first failure, keeping the failed op and the rest', async () => {
    const backend = new FakeBackend();
    backend.failOnCalls = [2];
    const q = new SyncQueue();
    q.enqueue({ kind: 'push-session', session: session('a') });
    q.enqueue({ kind: 'push-session', session: session('b') });
    q.enqueue({ kind: 'put-routine', routine: routine('v1') });

    const first = await q.flush(backend);
    expect(first).toEqual({ flushed: 1, remaining: 2 });
    expect(backend.state.sessions.map((s) => s.id)).toEqual(['a']);
    expect(q.ops()).toHaveLength(2);

    const second = await q.flush(backend);
    expect(second).toEqual({ flushed: 2, remaining: 0 });
    expect(backend.state.sessions.map((s) => s.id)).toEqual(['a', 'b']);
    expect(backend.state.routine?.name).toBe('v1');
  });
});

describe('persistence', () => {
  it('round-trips through serialize/deserialize', () => {
    const q = new SyncQueue();
    q.enqueue({ kind: 'push-session', session: session('a') });
    q.enqueue({ kind: 'put-profile', profile: { name: 'R', email: '', units: 'kg', defaultRestSec: 90, memberSince: 'x', updatedAt: 1 } });
    const revived = SyncQueue.deserialize(q.serialize());
    expect(revived.ops()).toEqual(q.ops());
  });

  it('treats garbage and null as an empty queue', () => {
    expect(SyncQueue.deserialize('{nope').ops()).toEqual([]);
    expect(SyncQueue.deserialize('"a string"').ops()).toEqual([]);
    expect(SyncQueue.deserialize(null).ops()).toEqual([]);
  });
});
