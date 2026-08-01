import { SEED_ROUTINE_ID, type PersistedSet, type Profile, type Routine, type RoutineItem, type SessionRecord } from '../state';

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
  /** Per-set logs aligned with exercise_ids; [] for records that predate
   * set persistence. */
  sets: PersistedSet[][];
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

const isoZ = (timestamptz: string): string => new Date(timestamptz).toISOString();

export function sessionToRow(session: SessionRecord, userId: string): SessionRow {
  return {
    id: session.id,
    user_id: userId,
    date: session.date,
    name: session.name,
    duration_sec: session.durationSec,
    volume_kg: session.volumeKg,
    set_count: session.setCount,
    exercise_ids: session.exerciseIds,
    regions: session.regions,
    sets: session.sets ?? [],
  };
}

export function rowToSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    date: isoZ(row.date),
    name: row.name,
    durationSec: row.duration_sec,
    volumeKg: row.volume_kg,
    setCount: row.set_count,
    exerciseIds: row.exercise_ids,
    regions: row.regions,
    ...(row.sets.length > 0 ? { sets: row.sets } : {}),
  };
}

export function routineToRow(routine: Routine, userId: string): RoutineRow {
  return {
    user_id: userId,
    name: routine.name,
    rest_sec: routine.restSec,
    items: routine.items,
    updated_at_ms: routine.updatedAt ?? 0,
  };
}

export function rowToRoutine(row: RoutineRow): Routine {
  return {
    // The singleton row predates routine ids — it is the nil-id document by
    // the identity convention (routineToRow drops the id symmetrically).
    id: SEED_ROUTINE_ID,
    name: row.name,
    restSec: row.rest_sec,
    items: row.items,
    ...(row.updated_at_ms > 0 ? { updatedAt: row.updated_at_ms } : {}),
  };
}

export function profileToRow(profile: Profile, userId: string): ProfileRow {
  return {
    user_id: userId,
    name: profile.name,
    email: profile.email,
    units: profile.units,
    default_rest_sec: profile.defaultRestSec,
    member_since: profile.memberSince,
    updated_at_ms: profile.updatedAt ?? 0,
  };
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    name: row.name,
    email: row.email,
    units: row.units,
    defaultRestSec: row.default_rest_sec,
    memberSince: isoZ(row.member_since),
    ...(row.updated_at_ms > 0 ? { updatedAt: row.updated_at_ms } : {}),
  };
}
