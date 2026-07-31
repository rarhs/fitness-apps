import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { useAppState, type Persisted } from './state';
import { SyncController } from './sync/controller';
import { SyncQueue } from './sync/queue';
import { SupabaseBackend } from './sync/supabase-backend';
import { supabase } from './supabase';

const QUEUE_KEY = 'vault:syncq:v1';

const readQueue = (): string | null => {
  try {
    return localStorage.getItem(QUEUE_KEY);
  } catch {
    return null;
  }
};

export interface SyncState {
  /** True once the signed-in session has completed its first merge. */
  active: boolean;
  /** Buffered writes the backend has not accepted yet. */
  pending: number;
}

const Ctx = createContext<SyncState>({ active: false, pending: 0 });

/** Wires the signed-in session to the sync engine: on sign-in, fetch + merge
 * + hydrate and push the plan; afterwards every state change flows through
 * the SyncController's queue, persisted so a reload keeps unflushed writes.
 * Retries on reconnect and on a slow interval. Must sit inside both
 * AppStateProvider and AuthProvider. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const app = useAppState();
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(0);

  const data = useMemo<Persisted>(
    () => ({
      routine: app.routine,
      recents: app.recents,
      saved: app.saved,
      history: app.history,
      profile: app.profile,
      prefs: app.prefs,
    }),
    [app.routine, app.recents, app.saved, app.history, app.profile, app.prefs],
  );
  const dataRef = useRef(data);
  dataRef.current = data;
  const hydrateRef = useRef(app.hydrate);
  hydrateRef.current = app.hydrate;

  const controllerRef = useRef<SyncController | null>(null);

  const persist = () => {
    const ctl = controllerRef.current;
    if (!ctl) return;
    try {
      localStorage.setItem(QUEUE_KEY, ctl.serializeQueue());
    } catch {
      // Persistence is best-effort; the in-memory queue still flushes.
    }
    setPending(ctl.pending());
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase || !userId) {
      // Signed out: any buffered writes belong to the account that left.
      try {
        localStorage.removeItem(QUEUE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    let cancelled = false;
    const backend = new SupabaseBackend(supabase, userId);
    const ctl = new SyncController(backend, SyncQueue.deserialize(readQueue()));

    const begin = async () => {
      try {
        const merged = await ctl.start(() => dataRef.current);
        if (cancelled) return;
        controllerRef.current = ctl;
        hydrateRef.current(merged);
        setActive(true);
        persistRef.current();
      } catch {
        // Offline at load — begin() runs again on reconnect / interval.
      }
    };
    const poke = () => {
      if (cancelled) return;
      if (!controllerRef.current) {
        void begin();
      } else {
        void controllerRef.current.flush().then(() => {
          if (!cancelled) persistRef.current();
        });
      }
    };

    void begin();
    window.addEventListener('online', poke);
    const timer = window.setInterval(poke, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', poke);
      window.clearInterval(timer);
      controllerRef.current = null;
      setActive(false);
      setPending(0);
    };
  }, [userId]);

  useEffect(() => {
    const ctl = controllerRef.current;
    if (!ctl) return;
    void ctl.onChange(data).then(() => persistRef.current());
  }, [data]);

  const value = useMemo(() => ({ active, pending }), [active, pending]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncState {
  return useContext(Ctx);
}
