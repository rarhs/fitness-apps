/** Languages present in the dataset as of the last sync. Upstream may add more
 * (French already exists upstream); treat this as informative, not exhaustive. */
export const KNOWN_LANGUAGES = ['en', 'es', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko'] as const;
export type KnownLanguage = (typeof KNOWN_LANGUAGES)[number];

export type BodyPart =
  | 'back'
  | 'cardio'
  | 'chest'
  | 'lower arms'
  | 'lower legs'
  | 'neck'
  | 'shoulders'
  | 'upper arms'
  | 'upper legs'
  | 'waist';

/** Full record shape of data/exercises.json in rarhs/exercises-dataset.
 * IDs are zero-padded 4-digit strings and are NOT contiguous. */
export interface Exercise {
  id: string;
  name: string;
  /** Mirrors body_part. */
  category: string;
  body_part: BodyPart;
  equipment: string;
  /** Full instructions as a single string, keyed by ISO 639-1 language code. */
  instructions: Record<string, string>;
  /** Same instructions split into ordered steps, keyed by language code. */
  instruction_steps: Record<string, string[]>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string;
  /** Repo-relative path, e.g. "images/0001-2gPfomN.jpg" (180×180 thumbnail). */
  image: string;
  /** Repo-relative path, e.g. "videos/0001-2gPfomN.gif" (180×180 animation). */
  gif_url: string;
  attribution: string;
  created_at: string;
}

/** Slim entry in the generated exercise index — everything except instruction
 * text, small enough to bundle into an app. */
export type ExerciseIndexEntry = Omit<Exercise, 'instructions' | 'instruction_steps' | 'attribution' | 'created_at'>;
