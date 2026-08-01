import type { PersistedSet, SessionRecord } from './state';
import { LB_TO_KG } from './lib';

export interface LoggedSet {
  reps: number;
  load: number;
}

export interface SessionMovement {
  id: string;
  bodyPart: string;
  setCount: number;
}

/** Trailing number of a reps target ("8-10" → "10") — the working prefill. */
export function targetReps(reps: string): string {
  const m = reps.match(/(\d+)(?!.*\d)/);
  return m ? m[1]! : '';
}

/** The most recent session's logged sets for an exercise (by date, skipping
 * legacy records and empty set lists), loads converted to the display unit
 * and rounded to two decimals; null when it has no per-set history. */
export function lastLoggedSets(
  history: SessionRecord[],
  exerciseId: string,
  unit: 'kg' | 'lb',
): { date: string; sets: LoggedSet[] } | null {
  let best: { date: string; sets: PersistedSet[] } | null = null;
  for (const rec of history) {
    const idx = rec.exerciseIds.findIndex(
      (id, i) => id === exerciseId && (rec.sets?.[i]?.length ?? 0) > 0,
    );
    if (idx === -1) continue;
    if (!best || new Date(rec.date).getTime() > new Date(best.date).getTime()) {
      best = { date: rec.date, sets: rec.sets![idx]! };
    }
  }
  if (!best) return null;
  const factor = unit === 'lb' ? 1 / LB_TO_KG : 1;
  return {
    date: best.date,
    sets: best.sets.map((s) => ({ reps: s.reps, load: Math.round(s.loadKg * factor * 100) / 100 })),
  };
}

/** "10×80, 8×80 kg" summary of logged sets — bodyweight sets show reps only,
 * with a "reps" suffix when no set carried a load. */
export function summarizeSets(sets: LoggedSet[], unit: string): string {
  if (sets.length === 0) return '';
  const body = sets.map((s) => (s.load > 0 ? `${s.reps}×${s.load}` : `${s.reps}`)).join(', ');
  return sets.some((s) => s.load > 0) ? `${body} ${unit}` : `${body} reps`;
}

/** Prefill for the upcoming set's inputs: last time's same-numbered set wins;
 * otherwise reps fall back to the routine target and load to the previous set
 * logged this session (blank when neither exists). */
export function setPrefill(
  last: LoggedSet | undefined,
  target: string,
  prevLoad: number | undefined,
): { reps: string; load: string } {
  return {
    reps: last ? String(last.reps) : targetReps(target),
    load:
      last && last.load > 0 ? String(last.load) : prevLoad !== undefined ? String(prevLoad) : '',
  };
}

/** Total volume of logged sets, converted to kg when logged in pounds. */
export function sessionVolumeKg(logs: Record<number, LoggedSet[]>, unit: 'kg' | 'lb'): number {
  const factor = unit === 'lb' ? LB_TO_KG : 1;
  return Object.values(logs)
    .flat()
    .reduce((sum, s) => sum + s.reps * s.load * factor, 0);
}

/** Logged sets per body_part, keyed by the movement index into `movements`. */
export function aggregateRegions(
  movements: SessionMovement[],
  logs: Record<number, LoggedSet[]>,
): Record<string, number> {
  const regions: Record<string, number> = {};
  for (const [idx, sets] of Object.entries(logs)) {
    const m = movements[Number(idx)];
    if (m && sets.length > 0) regions[m.bodyPart] = (regions[m.bodyPart] ?? 0) + sets.length;
  }
  return regions;
}

/** Per-set logs in persisted form: one entry per movement (empty when none
 * were logged), loads normalised to kg and rounded to two decimals. */
export function persistedSets(
  movements: SessionMovement[],
  logs: Record<number, LoggedSet[]>,
  unit: 'kg' | 'lb',
): PersistedSet[][] {
  const factor = unit === 'lb' ? LB_TO_KG : 1;
  return movements.map((_, i) =>
    (logs[i] ?? []).map((s) => ({ reps: s.reps, loadKg: Math.round(s.load * factor * 100) / 100 })),
  );
}

export function buildSessionRecord(opts: {
  movements: SessionMovement[];
  logs: Record<number, LoggedSet[]>;
  unit: 'kg' | 'lb';
  name: string;
  startMs: number;
  endMs: number;
  /** Injectable for tests; defaults to a fresh UUID. */
  id?: string;
}): SessionRecord {
  const { movements, logs, unit, name, startMs, endMs } = opts;
  return {
    id: opts.id ?? crypto.randomUUID(),
    date: new Date(endMs).toISOString(),
    name,
    durationSec: Math.round((endMs - startMs) / 1000),
    volumeKg: Math.round(sessionVolumeKg(logs, unit)),
    setCount: Object.values(logs).flat().length,
    exerciseIds: movements.map((m) => m.id),
    regions: aggregateRegions(movements, logs),
    sets: persistedSets(movements, logs, unit),
  };
}
