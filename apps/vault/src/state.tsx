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

export interface Persisted {
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

export function defaults(): Persisted {
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

/** Read persisted state, falling back to defaults on missing or malformed data.
 * A partial object (e.g. from an older version) is merged over the defaults. */
export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults();
    return { ...defaults(), ...parsed };
  } catch {
    return defaults();
  }
}

/** Pure state transitions — the provider wraps each in setState. A mutation
 * returns its input unchanged (same reference) when there is nothing to do. */
export const mutations = {
  setRoutine(d: Persisted, update: (r: Routine) => Routine): Persisted {
    return { ...d, routine: update(d.routine) };
  },
  addToRoutine(d: Persisted, id: string): Persisted {
    if (d.routine.items.some((i) => i.id === id)) return d;
    return {
      ...d,
      routine: { ...d.routine, items: [...d.routine.items, { id, sets: '4', reps: '8-10' }] },
    };
  },
  removeFromRoutine(d: Persisted, id: string): Persisted {
    return { ...d, routine: { ...d.routine, items: d.routine.items.filter((i) => i.id !== id) } };
  },
  pushRecent(d: Persisted, id: string): Persisted {
    if (d.recents[0] === id) return d;
    return { ...d, recents: [id, ...d.recents.filter((r) => r !== id)].slice(0, 10) };
  },
  toggleSaved(d: Persisted, id: string): Persisted {
    return {
      ...d,
      saved: d.saved.includes(id) ? d.saved.filter((s) => s !== id) : [...d.saved, id],
    };
  },
  addSession(d: Persisted, rec: SessionRecord): Persisted {
    return { ...d, history: [rec, ...d.history] };
  },
  setProfile(d: Persisted, patch: Partial<Profile>): Persisted {
    return { ...d, profile: { ...d.profile, ...patch } };
  },
  togglePref(d: Persisted, index: number): Persisted {
    return { ...d, prefs: d.prefs.map((p, i) => (i === index ? !p : p)) };
  },
};

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
  const [data, setData] = useState<Persisted>(loadPersisted);

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
      setRoutine: (update) => setData((d) => mutations.setRoutine(d, update)),
      addToRoutine: (id) => setData((d) => mutations.addToRoutine(d, id)),
      removeFromRoutine: (id) => setData((d) => mutations.removeFromRoutine(d, id)),
      pushRecent: (id) => setData((d) => mutations.pushRecent(d, id)),
      toggleSaved: (id) => setData((d) => mutations.toggleSaved(d, id)),
      addSession: (rec) => setData((d) => mutations.addSession(d, rec)),
      setProfile: (patch) => setData((d) => mutations.setProfile(d, patch)),
      togglePref: (index) => setData((d) => mutations.togglePref(d, index)),
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
