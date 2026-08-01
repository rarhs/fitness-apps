import { SEED_ROUTINE_ID, type Persisted, type Routine } from '../state';
import type { PushPlan, SyncOp } from './types';

const changed = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

/** The one routine the pre-multi-routine backend can hold: the live nil-id
 * document. Non-nil routines and deletions stay local until the schema lands. */
const liveNil = (d: Persisted): Routine | undefined =>
  d.routines.find((r) => r.id === SEED_ROUTINE_ID && !r.deletedAt);

/** SyncOps a state transition implies. Sessions are matched by id (oldest
 * first, so replay order preserves history order); the nil routine, profile
 * and saved compare by value; recents, prefs and the active routine are
 * device-local and never sync. */
export function opsForTransition(prev: Persisted, next: Persisted): SyncOp[] {
  const ops: SyncOp[] = [];
  const known = new Set(prev.history.map((h) => h.id));
  for (const s of [...next.history].reverse()) {
    if (!known.has(s.id)) ops.push({ kind: 'push-session', session: s });
  }
  const nextNil = liveNil(next);
  if (nextNil && changed(liveNil(prev), nextNil)) ops.push({ kind: 'put-routine', routine: nextNil });
  if (changed(prev.profile, next.profile)) ops.push({ kind: 'put-profile', profile: next.profile });
  if (changed(prev.saved, next.saved)) ops.push({ kind: 'put-saved', saved: next.saved });
  return ops;
}

/** Turn a merge's push plan into queueable ops carrying the merged documents. */
export function planOps(merged: Persisted, push: PushPlan): SyncOp[] {
  const ops: SyncOp[] = push.sessions.map((session) => ({ kind: 'push-session' as const, session }));
  const nil = liveNil(merged);
  if (push.routine && nil) ops.push({ kind: 'put-routine', routine: nil });
  if (push.profile) ops.push({ kind: 'put-profile', profile: merged.profile });
  if (push.saved) ops.push({ kind: 'put-saved', saved: merged.saved });
  return ops;
}
