import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface RoutineItem {
  id: string;
  sets: string;
  reps: string;
}

export interface Routine {
  name: string;
  restSec: number;
  items: RoutineItem[];
}

export interface SessionRecord {
  date: string;
  name: string;
  durationSec: number;
  volumeKg: number;
  setCount: number;
  exerciseIds: string[];
  /** Logged sets per body_part. */
  regions: Record<string, number>;
}

export interface Profile {
  name: string;
  email: string;
  units: 'kg' | 'lb';
  defaultRestSec: number;
  memberSince: string;
}

interface Persisted {
  routine: Routine;
  recents: string[];
  saved: string[];
  history: SessionRecord[];
  profile: Profile;
  prefs: boolean[];
}

/** A push day seeded from real dataset IDs so the builder isn't empty on first run. */
const DEFAULT_ROUTINE: Routine = {
  name: 'Push A',
  restSec: 90,
  items: [
    { id: '0025', sets: '4', reps: '8-10' }, // barbell bench press
    { id: '0047', sets: '4', reps: '8-10' }, // barbell incline bench press
    { id: '0405', sets: '4', reps: '8-10' }, // dumbbell seated shoulder press
    { id: '0334', sets: '4', reps: '12-15' }, // dumbbell lateral raise
    { id: '0201', sets: '4', reps: '10-12' }, // cable pushdown
    { id: '0814', sets: '3', reps: '8-12' }, // triceps dip
  ],
};

const STORAGE_KEY = 'vault:v1';

function defaults(): Persisted {
  return {
    routine: DEFAULT_ROUTINE,
    recents: [],
    saved: [],
    history: [],
    profile: {
      name: 'Guest',
      email: '',
      units: 'kg',
      defaultRestSec: 90,
      memberSince: new Date().toISOString(),
    },
    prefs: [true, false, true, true],
  };
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return defaults();
  }
}

export interface AppState extends Persisted {
  setRoutine: (update: (r: Routine) => Routine) => void;
  addToRoutine: (id: string) => void;
  removeFromRoutine: (id: string) => void;
  pushRecent: (id: string) => void;
  toggleSaved: (id: string) => void;
  addSession: (rec: SessionRecord) => void;
  setProfile: (patch: Partial<Profile>) => void;
  togglePref: (index: number) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Persistence is best-effort; the app works without it.
    }
  }, [data]);

  const api = useMemo<AppState>(
    () => ({
      ...data,
      setRoutine: (update) => setData((d) => ({ ...d, routine: update(d.routine) })),
      addToRoutine: (id) =>
        setData((d) =>
          d.routine.items.some((i) => i.id === id)
            ? d
            : { ...d, routine: { ...d.routine, items: [...d.routine.items, { id, sets: '4', reps: '8-10' }] } },
        ),
      removeFromRoutine: (id) =>
        setData((d) => ({ ...d, routine: { ...d.routine, items: d.routine.items.filter((i) => i.id !== id) } })),
      pushRecent: (id) =>
        setData((d) =>
          d.recents[0] === id
            ? d
            : { ...d, recents: [id, ...d.recents.filter((r) => r !== id)].slice(0, 10) },
        ),
      toggleSaved: (id) =>
        setData((d) => ({
          ...d,
          saved: d.saved.includes(id) ? d.saved.filter((s) => s !== id) : [...d.saved, id],
        })),
      addSession: (rec) => setData((d) => ({ ...d, history: [rec, ...d.history] })),
      setProfile: (patch) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } })),
      togglePref: (index) =>
        setData((d) => ({ ...d, prefs: d.prefs.map((p, i) => (i === index ? !p : p)) })),
    }),
    [data],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'V';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
