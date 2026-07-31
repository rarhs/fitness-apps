import type { Profile, Routine, RoutineItem, SessionRecord } from '../state';

/** Row shapes as PostgREST serializes them (see supabase/migrations). */
export interface SessionRow {
  id: string;
  user_id: string;
  date: string;
  name: string;
  duration_sec: number;
  volume_kg: number;
  set_count: number;
  exercise_ids: string[];
  regions: Record<string, number>;
}

export interface RoutineRow {
  user_id: string;
  name: string;
  rest_sec: number;
  items: RoutineItem[];
  updated_at_ms: number;
}

export interface ProfileRow {
  user_id: string;
  name: string;
  email: string;
  units: 'kg' | 'lb';
  default_rest_sec: number;
  member_since: string;
  updated_at_ms: number;
}

/* Mapping conventions:
 * - timestamptz strings normalize to ISO-8601 Z on the way in.
 * - updatedAt (client LWW clock) ↔ updated_at_ms, where absent ↔ 0.
 * - user_id is stamped on the way out and dropped on the way in.
 */

export function sessionToRow(session: SessionRecord, userId: string): SessionRow {
  void session;
  void userId;
  throw new Error('not implemented');
}

export function rowToSession(row: SessionRow): SessionRecord {
  void row;
  throw new Error('not implemented');
}

export function routineToRow(routine: Routine, userId: string): RoutineRow {
  void routine;
  void userId;
  throw new Error('not implemented');
}

export function rowToRoutine(row: RoutineRow): Routine {
  void row;
  throw new Error('not implemented');
}

export function profileToRow(profile: Profile, userId: string): ProfileRow {
  void profile;
  void userId;
  throw new Error('not implemented');
}

export function rowToProfile(row: ProfileRow): Profile {
  void row;
  throw new Error('not implemented');
}
