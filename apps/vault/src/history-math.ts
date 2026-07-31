import type { SessionRecord } from './state';

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
