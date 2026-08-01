import { SEED_ROUTINE_ID, type Persisted, type Profile, type Routine } from '../state';
import type { MergeResult, RemoteState } from './types';

const touched = (updatedAt?: number): boolean => (updatedAt ?? 0) > 0;

/** Last-write-wins between a local and a remote document. Absent remote keeps
 * local (pushed only if ever touched); otherwise the newer updatedAt wins and
 * ties go to remote. */
function lww<T extends Routine | Profile>(
  local: T,
  remote: T | null,
): { value: T; push: boolean } {
  if (remote === null) return { value: local, push: touched(local.updatedAt) };
  if ((local.updatedAt ?? 0) > (remote.updatedAt ?? 0)) return { value: local, push: true };
  return { value: remote, push: false };
}

/** Reconcile local (localStorage) state with the backend's state.
 *
 * - Sessions are append-only facts keyed by client UUID: union both sides,
 *   newest first; local-only sessions go into the push plan.
 * - Routines: until the multi-routine schema lands, the backend stores exactly
 *   one routine per user — by the identity convention, the nil-id one. Only
 *   that document is last-write-wins merged; other local routines pass through
 *   local-only. A tombstoned winner is never pushed (the old schema cannot
 *   represent deletion); a strictly newer remote edit revives it.
 * - Profile is last-write-wins on `updatedAt` (absent = never touched = 0;
 *   ties go to remote). An untouched local default is never pushed over a
 *   missing remote.
 * - Saved is a union; pushed when local contributes ids the remote lacks.
 * - Recents, prefs and the active routine are device-local and never merged.
 */
export function mergeStates(local: Persisted, remote: RemoteState): MergeResult {
  const remoteIds = new Set(remote.sessions.map((s) => s.id));
  const localIds = new Set(local.history.map((h) => h.id));
  const pushSessions = local.history.filter((h) => !remoteIds.has(h.id));
  const history = [...local.history, ...remote.sessions.filter((s) => !localIds.has(s.id))].sort(
    (a, b) => b.date.localeCompare(a.date),
  );

  const localNil = local.routines.find((r) => r.id === SEED_ROUTINE_ID);
  const remoteNil = remote.routine ? { ...remote.routine, id: SEED_ROUTINE_ID } : null;
  let routines = local.routines;
  let pushRoutine = false;
  if (localNil) {
    const nil = lww(localNil, remoteNil);
    routines = local.routines.map((r) => (r.id === SEED_ROUTINE_ID ? nil.value : r));
    pushRoutine = nil.push && !nil.value.deletedAt;
  } else if (remoteNil) {
    routines = [...local.routines, remoteNil];
  }
  const live = routines.filter((r) => !r.deletedAt);
  const activeRoutineId = live.some((r) => r.id === local.activeRoutineId)
    ? local.activeRoutineId
    : (live[0]?.id ?? local.activeRoutineId);

  const profile = lww(local.profile, remote.profile);

  const localSaved = new Set(local.saved);
  const remoteSaved = new Set(remote.saved);
  const saved = [...local.saved, ...remote.saved.filter((s) => !localSaved.has(s))];
  const pushSaved = local.saved.some((s) => !remoteSaved.has(s));

  return {
    merged: {
      ...local,
      history,
      routines,
      activeRoutineId,
      profile: profile.value,
      saved,
    },
    push: {
      sessions: pushSessions,
      routine: pushRoutine,
      profile: profile.push,
      saved: pushSaved,
    },
  };
}
