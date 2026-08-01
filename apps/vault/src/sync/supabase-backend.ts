import type { SupabaseClient } from '@supabase/supabase-js';
import { SEED_ROUTINE_ID, type Profile, type Routine, type SessionRecord } from '../state';
import {
  profileToRow,
  routineToRow,
  rowToProfile,
  rowToRoutine,
  rowToSession,
  sessionToRow,
  type ProfileRow,
  type RoutineRow,
  type SessionRow,
} from './rows';
import type { RemoteState, SyncBackend } from './types';

/** SyncBackend over supabase-js. Deliberately a dumb translation layer — all
 * sync intelligence lives in merge.ts/queue.ts, and correctness here is
 * covered by the contract tests against a real local Supabase stack.
 *
 * Sessions are append-only in the schema (no UPDATE policy), so pushSessions
 * upserts with ignoreDuplicates — re-pushing an id is a no-op, never a
 * rewrite. putSaved makes the remote set equal to the given list. RLS scopes
 * every query to the signed-in user; the explicit user_id filters are
 * defense-in-depth, not the security boundary. */
export class SupabaseBackend implements SyncBackend {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async fetchState(): Promise<RemoteState> {
    const [sessions, routine, profile, saved] = await Promise.all([
      this.client
        .from('sessions')
        .select('*')
        .eq('user_id', this.userId)
        .order('date', { ascending: false }),
      this.client.from('routines').select('*').eq('user_id', this.userId).maybeSingle(),
      this.client.from('profiles').select('*').eq('user_id', this.userId).maybeSingle(),
      this.client
        .from('saved_exercises')
        .select('exercise_id')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: true }),
    ]);
    const firstError = sessions.error ?? routine.error ?? profile.error ?? saved.error;
    if (firstError) throw firstError;
    return {
      sessions: ((sessions.data ?? []) as SessionRow[]).map(rowToSession),
      routines: routine.data ? [rowToRoutine(routine.data as RoutineRow)] : [],
      profile: profile.data ? rowToProfile(profile.data as ProfileRow) : null,
      saved: (saved.data ?? []).map((r) => (r as { exercise_id: string }).exercise_id),
    };
  }

  async pushSessions(sessions: SessionRecord[]): Promise<void> {
    if (sessions.length === 0) return;
    const { error } = await this.client
      .from('sessions')
      .upsert(
        sessions.map((s) => sessionToRow(s, this.userId)),
        { onConflict: 'id', ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  async putRoutine(routine: Routine): Promise<void> {
    // Interim, until the multi-routine schema lands: the routines table is a
    // singleton row per user with no id or deleted_at columns, so only the
    // live nil-id document can be represented. Everything else is dropped
    // HERE and only here — the layers above already speak full collection
    // semantics, and this guard is what the schema slice deletes.
    if (routine.id !== SEED_ROUTINE_ID || routine.deletedAt) return;
    const { error } = await this.client
      .from('routines')
      .upsert(routineToRow(routine, this.userId), { onConflict: 'user_id' });
    if (error) throw error;
  }

  async putProfile(profile: Profile): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .upsert(profileToRow(profile, this.userId), { onConflict: 'user_id' });
    if (error) throw error;
  }

  async putSaved(saved: string[]): Promise<void> {
    if (saved.length > 0) {
      const rows = saved.map((exercise_id) => ({ user_id: this.userId, exercise_id }));
      const { error } = await this.client
        .from('saved_exercises')
        .upsert(rows, { onConflict: 'user_id,exercise_id', ignoreDuplicates: true });
      if (error) throw error;
    }
    let remove = this.client.from('saved_exercises').delete().eq('user_id', this.userId);
    if (saved.length > 0) {
      remove = remove.not('exercise_id', 'in', `(${saved.map((id) => `"${id}"`).join(',')})`);
    }
    const { error } = await remove;
    if (error) throw error;
  }
}
