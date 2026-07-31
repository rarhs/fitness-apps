import { DEFAULT_MEDIA_BASE } from './media';
import type { Exercise } from './types';

export const DATASET_URL = `${DEFAULT_MEDIA_BASE}/data/exercises.json`;

let cache: Promise<Exercise[]> | null = null;

/** Fetch the full dataset (all languages + instruction text, ~14 MB) once and
 * cache it in memory. Use EXERCISE_INDEX for anything that doesn't need
 * instruction text. */
export function fetchFullDataset(url: string = DATASET_URL): Promise<Exercise[]> {
  if (!cache) {
    cache = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status} ${res.statusText}`);
      return res.json() as Promise<Exercise[]>;
    });
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

export async function fetchExercise(id: string): Promise<Exercise | undefined> {
  const data = await fetchFullDataset();
  return data.find((ex) => ex.id === id);
}

/** Instruction steps for a language, falling back to English, then empty. */
export function instructionSteps(ex: Exercise, lang: string, fallback = 'en'): string[] {
  return ex.instruction_steps[lang] ?? ex.instruction_steps[fallback] ?? [];
}
