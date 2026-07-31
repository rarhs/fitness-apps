import type { Persisted } from '../state';
import type { PushPlan, SyncOp } from './types';

const changed = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

/** SyncOps a state transition implies. Sessions are matched by id (oldest
 * first, so replay order preserves history order); routine, profile and saved
 * compare by value; recents and prefs are device-local and never sync. */
export function opsForTransition(prev: Persisted, next: Persisted): SyncOp[] {
  const ops: SyncOp[] = [];
  const known = new Set(prev.history.map((h) => h.id));
  for (const s of [...next.history].reverse()) {
    if (!known.has(s.id)) ops.push({ kind: 'push-session', session: s });
  }
  if (changed(prev.routine, next.routine)) ops.push({ kind: 'put-routine', routine: next.routine });
  if (changed(prev.profile, next.profile)) ops.push({ kind: 'put-profile', profile: next.profile });
  if (changed(prev.saved, next.saved)) ops.push({ kind: 'put-saved', saved: next.saved });
  return ops;
}

/** Turn a merge's push plan into queueable ops carrying the merged documents. */
export function planOps(merged: Persisted, push: PushPlan): SyncOp[] {
  const ops: SyncOp[] = push.sessions.map((session) => ({ kind: 'push-session' as const, session }));
  if (push.routine) ops.push({ kind: 'put-routine', routine: merged.routine });
  if (push.profile) ops.push({ kind: 'put-profile', profile: merged.profile });
  if (push.saved) ops.push({ kind: 'put-saved', saved: merged.saved });
  return ops;
}
