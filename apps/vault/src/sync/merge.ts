import { withLiveRoutine, type Persisted, type Profile, type Routine } from '../state';
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
 * - Routines are a union by id with per-id last-write-wins. A tombstone
 *   participates like any edit: a newer local deletion wins and is pushed; a
 *   newer remote edit revives. Touched local-only routines are pushed; an
 *   untouched local seed is discarded once the remote contributes anything;
 *   remote-only routines are adopted. If nothing live survives, a fresh seed
 *   is appended so the app never ends up without a routine.
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

  const remoteById = new Map(remote.routines.map((r) => [r.id, r]));
  const localRoutineIds = new Set(local.routines.map((r) => r.id));
  const kept: Routine[] = [];
  const pushRoutines: Routine[] = [];
  for (const l of local.routines) {
    const r = remoteById.get(l.id);
    if (r === undefined) {
      if (!touched(l.updatedAt) && remote.routines.length > 0) continue;
      kept.push(l);
      if (touched(l.updatedAt)) pushRoutines.push(l);
    } else if ((l.updatedAt ?? 0) > (r.updatedAt ?? 0)) {
      kept.push(l);
      pushRoutines.push(l);
    } else {
      kept.push(r);
    }
  }
  const routines = withLiveRoutine([
    ...kept,
    ...remote.routines.filter((r) => !localRoutineIds.has(r.id)),
  ]);
  const live = routines.filter((r) => !r.deletedAt);
  const activeRoutineId = live.some((r) => r.id === local.activeRoutineId)
    ? local.activeRoutineId
    : live[0]!.id;

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
      routines: pushRoutines,
      profile: profile.push,
      saved: pushSaved,
    },
  };
}
