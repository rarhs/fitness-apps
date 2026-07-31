import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Routine, SessionRecord } from '../state';
import type { RemoteState, SyncBackend } from './types';

/** SyncBackend over supabase-js. Deliberately a dumb translation layer — all
 * sync intelligence lives in merge.ts/queue.ts, and correctness here is
 * covered by the contract tests against a real local Supabase stack.
 *
 * Sessions are append-only in the schema (no UPDATE policy), so pushSessions
 * upserts with ignoreDuplicates — re-pushing an id is a no-op, never a
 * rewrite. putSaved makes the remote set equal to the given list. */
export class SupabaseBackend implements SyncBackend {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async fetchState(): Promise<RemoteState> {
    throw new Error('not implemented');
  }

  async pushSessions(sessions: SessionRecord[]): Promise<void> {
    void sessions;
    throw new Error('not implemented');
  }

  async putRoutine(routine: Routine): Promise<void> {
    void routine;
    throw new Error('not implemented');
  }

  async putProfile(profile: Profile): Promise<void> {
    void profile;
    throw new Error('not implemented');
  }

  async putSaved(saved: string[]): Promise<void> {
    void saved;
    throw new Error('not implemented');
  }

  /** Referenced by the not-implemented methods once they exist. */
  protected get ids(): { client: SupabaseClient; userId: string } {
    return { client: this.client, userId: this.userId };
  }
}
