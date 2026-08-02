import { LB_TO_KG } from './lib';
import type { PersistedSet, SessionRecord } from './state';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const WINDOW_WEEKS = 12;

/** True when the record's age lies in [fromWeeks, toWeeks) weeks before `now`. */
export function inWindow(rec: SessionRecord, now: number, fromWeeks: number, toWeeks: number): boolean {
  const age = now - new Date(rec.date).getTime();
  return age >= fromWeeks * WEEK_MS && age < toWeeks * WEEK_MS;
}

/** The current window and the one before it, for delta comparisons. */
export function splitWindows(
  history: SessionRecord[],
  now: number,
  weeks: number = WINDOW_WEEKS,
): { recent: SessionRecord[]; prior: SessionRecord[] } {
  return {
    recent: history.filter((r) => inWindow(r, now, 0, weeks)),
    prior: history.filter((r) => inWindow(r, now, weeks, weeks * 2)),
  };
}

/** Volume per week, oldest first — index weeks-1 is the current week. */
export function weeklyVolumes(
  history: SessionRecord[],
  now: number,
  weeks: number = WINDOW_WEEKS,
): number[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weeksAgo = weeks - 1 - i;
    return history
      .filter((r) => inWindow(r, now, weeksAgo, weeksAgo + 1))
      .reduce((n, r) => n + r.volumeKg, 0);
  });
}

export function totalTonnageKg(recs: SessionRecord[]): number {
  return recs.reduce((n, r) => n + r.volumeKg, 0);
}

export function avgDurationMin(recs: SessionRecord[]): number {
  if (recs.length === 0) return 0;
  return recs.reduce((n, r) => n + r.durationSec, 0) / recs.length / 60;
}

export function distinctExerciseCount(recs: SessionRecord[]): number {
  return new Set(recs.flatMap((r) => r.exerciseIds)).size;
}

/** Top regions by logged sets, descending. */
export function regionBalance(recs: SessionRecord[], top: number = 6): [string, number][] {
  const totals = new Map<string, number>();
  for (const r of recs) {
    for (const [name, sets] of Object.entries(r.regions)) {
      totals.set(name, (totals.get(name) ?? 0) + sets);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

/** One charted session of an exercise, loads in the display unit. */
export interface ProgressionPoint {
  sessionId: string;
  date: string;
  /** Heaviest set; a tie on load goes to the set with more reps. */
  topSet: { reps: number; load: number };
  /** Best Epley estimate across the session's sets: load × (1 + reps/30),
   * the load itself at reps ≤ 1. */
  estOneRm: number;
  /** Σ reps × load across the session's sets for this exercise. */
  volume: number;
  /** Highest single-set rep count — the metric for bodyweight movements. */
  bestReps: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const epleyKg = (s: PersistedSet) => (s.reps <= 1 ? s.loadKg : s.loadKg * (1 + s.reps / 30));

/** Per-session progression of one exercise, oldest first. Sessions without
 * per-set data for the exercise (legacy records, nothing logged) are skipped;
 * every appearance of the exercise within a session is merged into one point. */
export function exerciseProgression(
  history: SessionRecord[],
  exerciseId: string,
  unit: 'kg' | 'lb',
): ProgressionPoint[] {
  const factor = unit === 'lb' ? 1 / LB_TO_KG : 1;
  const points: ProgressionPoint[] = [];
  for (const rec of history) {
    const sets = rec.exerciseIds.flatMap((id, i) => (id === exerciseId ? (rec.sets?.[i] ?? []) : []));
    if (sets.length === 0) continue;
    const top = sets.reduce((a, b) => (b.loadKg > a.loadKg || (b.loadKg === a.loadKg && b.reps > a.reps) ? b : a));
    points.push({
      sessionId: rec.id,
      date: rec.date,
      topSet: { reps: top.reps, load: round2(top.loadKg * factor) },
      estOneRm: round2(Math.max(...sets.map(epleyKg)) * factor),
      volume: round2(sets.reduce((n, s) => n + s.reps * s.loadKg, 0) * factor),
      bestReps: Math.max(...sets.map((s) => s.reps)),
    });
  }
  return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Exercises with at least two charted sessions, most-charted first; a tie on
 * count goes to the one trained most recently. */
export function topProgressedExercises(
  history: SessionRecord[],
  unit: 'kg' | 'lb',
  top: number = 6,
): { id: string; points: ProgressionPoint[] }[] {
  const ids = [...new Set(history.flatMap((r) => r.exerciseIds))];
  return ids
    .map((id) => ({ id, points: exerciseProgression(history, id, unit) }))
    .filter((t) => t.points.length >= 2)
    .sort(
      (a, b) =>
        b.points.length - a.points.length ||
        new Date(b.points.at(-1)!.date).getTime() - new Date(a.points.at(-1)!.date).getTime(),
    )
    .slice(0, top);
}
