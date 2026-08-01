import type { Persisted, Profile, Routine, SessionRecord } from '../state';

/** The user's data as the backend knows it. `null` means never written.
 * `routines` includes tombstones — the merge needs them to sync deletions. */
export interface RemoteState {
  sessions: SessionRecord[];
  routines: Routine[];
  profile: Profile | null;
  saved: string[];
}

/** What a merge decided must be written back to the backend. */
export interface PushPlan {
  /** Local sessions the remote doesn't have (append-only, keyed by id). */
  sessions: SessionRecord[];
  /** Routine documents to write, tombstones included. */
  routines: Routine[];
  profile: boolean;
  saved: boolean;
}

export interface MergeResult {
  merged: Persisted;
  push: PushPlan;
}

/** A buffered write, replayable against any backend. */
export type SyncOp =
  | { kind: 'push-session'; session: SessionRecord }
  | { kind: 'put-routine'; routine: Routine }
  | { kind: 'put-profile'; profile: Profile }
  | { kind: 'put-saved'; saved: string[] };

/** Transport boundary. The real implementation wraps supabase-js; tests use
 * FakeBackend. All writes must be idempotent (sessions upsert by id). */
export interface SyncBackend {
  fetchState(): Promise<RemoteState>;
  pushSessions(sessions: SessionRecord[]): Promise<void>;
  putRoutine(routine: Routine): Promise<void>;
  putProfile(profile: Profile): Promise<void>;
  putSaved(saved: string[]): Promise<void>;
}
