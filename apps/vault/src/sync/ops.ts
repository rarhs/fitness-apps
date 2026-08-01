import type { Persisted } from '../state';
import type { PushPlan, SyncOp } from './types';

const changed = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

/** SyncOps a state transition implies. Sessions are matched by id (oldest
 * first, so replay order preserves history order); routines are matched by id
 * — a new, edited or tombstoned routine each becomes its own put; profile and
 * saved compare by value; recents, prefs and the active routine are
 * device-local and never sync. */
export function opsForTransition(prev: Persisted, next: Persisted): SyncOp[] {
  const ops: SyncOp[] = [];
  const known = new Set(prev.history.map((h) => h.id));
  for (const s of [...next.history].reverse()) {
    if (!known.has(s.id)) ops.push({ kind: 'push-session', session: s });
  }
  const prevById = new Map(prev.routines.map((r) => [r.id, r]));
  for (const r of next.routines) {
    if (changed(prevById.get(r.id), r)) ops.push({ kind: 'put-routine', routine: r });
  }
  if (changed(prev.profile, next.profile)) ops.push({ kind: 'put-profile', profile: next.profile });
  if (changed(prev.saved, next.saved)) ops.push({ kind: 'put-saved', saved: next.saved });
  return ops;
}

/** Turn a merge's push plan into queueable ops carrying the merged documents. */
export function planOps(merged: Persisted, push: PushPlan): SyncOp[] {
  const ops: SyncOp[] = push.sessions.map((session) => ({ kind: 'push-session' as const, session }));
  for (const routine of push.routines) ops.push({ kind: 'put-routine', routine });
  if (push.profile) ops.push({ kind: 'put-profile', profile: merged.profile });
  if (push.saved) ops.push({ kind: 'put-saved', saved: merged.saved });
  return ops;
}
