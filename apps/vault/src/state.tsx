import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface RoutineItem {
  id: string;
  sets: string;
  reps: string;
}

export interface Routine {
  /** Client-generated UUID — the sync identity. The seeded/legacy routine
   * uses SEED_ROUTINE_ID so every device and the server converge on it. */
  id: string;
  name: string;
  restSec: number;
  items: RoutineItem[];
  /** ms epoch of the last user edit; absent = never touched (LWW loser). */
  updatedAt?: number;
  /** ms epoch tombstone; a deleted routine stays in the collection so the
   * deletion can sync, but is hidden from every UI read. */
  deletedAt?: number;
}

/** Identity of the seeded default and of a migrated legacy routine. The
 * schema migration keys the pre-existing server row under this same id. */
export const SEED_ROUTINE_ID = '00000000-0000-0000-0000-000000000000';

/** One logged set as persisted: load normalised to kg at record-build time. */
export interface PersistedSet {
  reps: number;
  loadKg: number;
}

export interface SessionRecord {
  /** Client-generated UUID — the append-only sync identity. */
  id: string;
  date: string;
  name: string;
  durationSec: number;
  volumeKg: number;
  setCount: number;
  exerciseIds: string[];
  /** Logged sets per body_part. */
  regions: Record<string, number>;
  /** Per-set logs, index-aligned with exerciseIds (sets[i] belongs to
   * exerciseIds[i]). Absent on records that predate set persistence. */
  sets?: PersistedSet[][];
}

export interface Profile {
  name: string;
  email: string;
  units: 'kg' | 'lb';
  defaultRestSec: number;
  memberSince: string;
  /** ms epoch of the last user edit; absent = never touched (LWW loser). */
  updatedAt?: number;
}

export interface Persisted {
  routines: Routine[];
  /** Device-local (never merged): which routine the UI is working with.
   * Always points at a live routine. */
  activeRoutineId: string;
  recents: string[];
  saved: string[];
  history: SessionRecord[];
  profile: Profile;
  prefs: boolean[];
}

export function liveRoutines(d: Persisted): Routine[] {
  return d.routines.filter((r) => !r.deletedAt);
}

export function activeRoutine(d: Persisted): Routine {
  return d.routines.find((r) => r.id === d.activeRoutineId && !r.deletedAt) ?? liveRoutines(d)[0]!;
}

/** `routines` unchanged while anything is live; otherwise a fresh seed is
 * appended (under the nil id when free, else a new UUID) so the app and the
 * merge never end up without a live routine. */
export function withLiveRoutine(routines: Routine[]): Routine[] {
  if (routines.some((r) => !r.deletedAt)) return routines;
  const idTaken = routines.some((r) => r.id === SEED_ROUTINE_ID);
  return [...routines, { ...DEFAULT_ROUTINE, ...(idTaken ? { id: crypto.randomUUID() } : {}) }];
}

/** `base` when no live routine uses it yet, else "base 2", "base 3", … */
export function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/** A push day seeded from real dataset IDs so the builder isn't empty on
 * first run — named as a disposable sample, not a program. */
const DEFAULT_ROUTINE: Routine = {
  id: SEED_ROUTINE_ID,
  name: 'Starter Push',
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
    routines: [DEFAULT_ROUTINE],
    activeRoutineId: SEED_ROUTINE_ID,
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
 * A partial object (e.g. from an older version) is merged over the defaults;
 * history entries that predate the sync id field get a UUID assigned. A legacy
 * single-routine payload migrates into the collection under SEED_ROUTINE_ID;
 * the result always has at least one live routine and a valid active id. */
export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Persisted> & { routine?: Omit<Routine, 'id'> };
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults();
    const { routine: legacyRoutine, ...rest } = parsed;
    const merged = { ...defaults(), ...rest };

    const routines = withLiveRoutine(
      Array.isArray(rest.routines)
        ? rest.routines.map((r) => (r.id ? r : { ...r, id: crypto.randomUUID() }))
        : legacyRoutine && typeof legacyRoutine === 'object'
          ? [{ ...legacyRoutine, id: SEED_ROUTINE_ID }]
          : defaults().routines,
    );
    const live = routines.filter((r) => !r.deletedAt);
    const activeRoutineId = live.some((r) => r.id === merged.activeRoutineId)
      ? merged.activeRoutineId
      : live[0]!.id;

    return {
      ...merged,
      routines,
      activeRoutineId,
      history: Array.isArray(merged.history)
        ? merged.history.map((h) => (h.id ? h : { ...h, id: crypto.randomUUID() }))
        : defaults().history,
    };
  } catch {
    return defaults();
  }
}

/** The active routine replaced by `edit`, id preserved and updatedAt stamped. */
const editActive = (d: Persisted, edit: (r: Routine) => Routine, now: number): Persisted => ({
  ...d,
  routines: d.routines.map((r) =>
    r.id === d.activeRoutineId ? { ...edit(r), id: r.id, updatedAt: now } : r,
  ),
});

/** Pure state transitions — the provider wraps each in setState. A mutation
 * returns its input unchanged (same reference) when there is nothing to do.
 * Mutations that edit a routine or the profile stamp `updatedAt` for
 * last-write-wins sync; `now` (and new routine ids) are injectable for tests.
 * setRoutine/addToRoutine/removeFromRoutine target the active routine. */
export const mutations = {
  setRoutine(d: Persisted, update: (r: Routine) => Routine, now: number = Date.now()): Persisted {
    return editActive(d, update, now);
  },
  addToRoutine(d: Persisted, id: string, now: number = Date.now()): Persisted {
    if (activeRoutine(d).items.some((i) => i.id === id)) return d;
    return editActive(d, (r) => ({ ...r, items: [...r.items, { id, sets: '4', reps: '8-10' }] }), now);
  },
  removeFromRoutine(d: Persisted, id: string, now: number = Date.now()): Persisted {
    if (!activeRoutine(d).items.some((i) => i.id === id)) return d;
    return editActive(d, (r) => ({ ...r, items: r.items.filter((i) => i.id !== id) }), now);
  },
  addRoutine(d: Persisted, now: number = Date.now(), id: string = crypto.randomUUID()): Persisted {
    const routine: Routine = {
      id,
      name: uniqueName('New routine', liveRoutines(d).map((r) => r.name)),
      restSec: d.profile.defaultRestSec,
      items: [],
      updatedAt: now,
    };
    return { ...d, routines: [...d.routines, routine], activeRoutineId: id };
  },
  duplicateRoutine(
    d: Persisted,
    sourceId: string,
    now: number = Date.now(),
    id: string = crypto.randomUUID(),
  ): Persisted {
    const src = d.routines.find((r) => r.id === sourceId && !r.deletedAt);
    if (!src) return d;
    const copy: Routine = {
      ...src,
      id,
      name: uniqueName(`${src.name} copy`, liveRoutines(d).map((r) => r.name)),
      updatedAt: now,
    };
    return { ...d, routines: [...d.routines, copy], activeRoutineId: id };
  },
  deleteRoutine(d: Persisted, id: string, now: number = Date.now()): Persisted {
    const target = d.routines.find((r) => r.id === id && !r.deletedAt);
    if (!target || liveRoutines(d).length <= 1) return d;
    const routines = d.routines.map((r) =>
      r.id === id ? { ...r, deletedAt: now, updatedAt: now } : r,
    );
    const activeRoutineId =
      d.activeRoutineId === id ? routines.find((r) => !r.deletedAt)!.id : d.activeRoutineId;
    return { ...d, routines, activeRoutineId };
  },
  selectRoutine(d: Persisted, id: string): Persisted {
    if (d.activeRoutineId === id || !d.routines.some((r) => r.id === id && !r.deletedAt)) return d;
    return { ...d, activeRoutineId: id };
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
  setProfile(d: Persisted, patch: Partial<Profile>, now: number = Date.now()): Persisted {
    return { ...d, profile: { ...d.profile, ...patch, updatedAt: now } };
  },
  togglePref(d: Persisted, index: number): Persisted {
    return { ...d, prefs: d.prefs.map((p, i) => (i === index ? !p : p)) };
  },
  /** Replace the whole state with a merge result, as-is. No stamps — the
   * merged object is already reconciled against the backend. */
  hydrate(_d: Persisted, merged: Persisted): Persisted {
    return merged;
  },
  /** Merge identity-derived fields into the profile WITHOUT stamping
   * updatedAt: a seed must lose last-write-wins to any profile the user
   * actually edited (possibly on another device). */
  seedProfile(d: Persisted, patch: Partial<Profile>): Persisted {
    return { ...d, profile: { ...d.profile, ...patch } };
  },
};

export interface AppState extends Persisted {
  /** The active routine — what the Builder edits and a session runs. */
  routine: Routine;
  setRoutine: (update: (r: Routine) => Routine) => void;
  addToRoutine: (id: string) => void;
  removeFromRoutine: (id: string) => void;
  addRoutine: () => void;
  duplicateRoutine: (id: string) => void;
  deleteRoutine: (id: string) => void;
  selectRoutine: (id: string) => void;
  pushRecent: (id: string) => void;
  toggleSaved: (id: string) => void;
  addSession: (rec: SessionRecord) => void;
  setProfile: (patch: Partial<Profile>) => void;
  togglePref: (index: number) => void;
  hydrate: (merged: Persisted) => void;
  seedProfile: (patch: Partial<Profile>) => void;
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
      routine: activeRoutine(data),
      setRoutine: (update) => setData((d) => mutations.setRoutine(d, update)),
      addToRoutine: (id) => setData((d) => mutations.addToRoutine(d, id)),
      removeFromRoutine: (id) => setData((d) => mutations.removeFromRoutine(d, id)),
      addRoutine: () => setData((d) => mutations.addRoutine(d)),
      duplicateRoutine: (id) => setData((d) => mutations.duplicateRoutine(d, id)),
      deleteRoutine: (id) => setData((d) => mutations.deleteRoutine(d, id)),
      selectRoutine: (id) => setData((d) => mutations.selectRoutine(d, id)),
      pushRecent: (id) => setData((d) => mutations.pushRecent(d, id)),
      toggleSaved: (id) => setData((d) => mutations.toggleSaved(d, id)),
      addSession: (rec) => setData((d) => mutations.addSession(d, rec)),
      setProfile: (patch) => setData((d) => mutations.setProfile(d, patch)),
      togglePref: (index) => setData((d) => mutations.togglePref(d, index)),
      hydrate: (merged) => setData((d) => mutations.hydrate(d, merged)),
      seedProfile: (patch) => setData((d) => mutations.seedProfile(d, patch)),
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
