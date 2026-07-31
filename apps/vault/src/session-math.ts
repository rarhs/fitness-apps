import type { SessionRecord } from './state';
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
  };
}
