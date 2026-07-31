import type { Persisted } from '../state';
import type { MergeResult, RemoteState } from './types';

/** Reconcile local (localStorage) state with the backend's state.
 *
 * - Sessions are append-only facts keyed by client UUID: union both sides,
 *   newest first; local-only sessions go into the push plan.
 * - Routine and profile are last-write-wins on `updatedAt` (absent = never
 *   touched = 0; ties go to remote). An untouched local default is never
 *   pushed over a missing remote.
 * - Saved is a union; pushed when local contributes ids the remote lacks.
 * - Recents and prefs are device-local and never merged.
 */
export function mergeStates(local: Persisted, remote: RemoteState): MergeResult {
  void local;
  void remote;
  throw new Error('not implemented');
}
