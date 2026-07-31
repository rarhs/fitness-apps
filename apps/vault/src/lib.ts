import { EXERCISE_INDEX, type ExerciseIndexEntry } from '@fitness-apps/exercise-data';

export const TOTAL = EXERCISE_INDEX.length;
export const MEDIA_COUNT = TOTAL * 2;

const BY_ID = new Map(EXERCISE_INDEX.map((e) => [e.id, e]));

export function exerciseById(id: string): ExerciseIndexEntry | undefined {
  return BY_ID.get(id);
}

/** Region copy from the design doc, keyed by body_part. */
export const REGION_BLURBS: Record<string, string> = {
  'upper arms': 'Biceps, triceps, forearms in flexion — the largest region in the catalogue.',
  waist: 'Abdominals, obliques and the deep stabilisers of the trunk.',
  'upper legs': 'Quadriceps, hamstrings, adductors and glutes.',
  back: 'Lats, traps, rhomboids, spine and erectors.',
  shoulders: 'Deltoid heads, rotator cuff and scapular control.',
  chest: 'Pectorals across incline, flat and decline planes.',
  'lower arms': 'Wrist flexors, extensors and grip work.',
  cardio: 'Conditioning and steady-state machine work.',
  'lower legs': 'Calves, soleus and the ankle complex.',
  neck: 'Cervical flexion and extension — the smallest region.',
};

export interface RegionStat {
  name: string;
  count: number;
  blurb: string;
  cover: ExerciseIndexEntry;
}

export const REGIONS: RegionStat[] = (() => {
  const counts = new Map<string, number>();
  for (const e of EXERCISE_INDEX) counts.set(e.body_part, (counts.get(e.body_part) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      blurb: REGION_BLURBS[name] ?? '',
      cover: EXERCISE_INDEX.find((e) => e.body_part === name)!,
    }));
})();

export const MAX_REGION_COUNT = REGIONS[0]?.count ?? 1;

export const EQUIPMENT: { name: string; count: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const e of EXERCISE_INDEX) counts.set(e.equipment, (counts.get(e.equipment) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
})();

export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Leading number of a reps string ("8-10" → 8); NaN-safe. */
export function repsNumber(reps: string): number {
  const n = parseInt(reps, 10);
  return Number.isFinite(n) ? n : 0;
}

export function setsNumber(sets: string): number {
  const n = parseInt(sets, 10);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

export const LB_TO_KG = 0.45359237;
