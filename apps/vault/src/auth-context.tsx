import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { profilePatchForUser } from './auth';
import { supabase } from './supabase';
import { useAppState } from './state';

export interface AuthState {
  /** False when the build has no Supabase config — sign-in is unavailable. */
  enabled: boolean;
  /** True once the initial session lookup has settled (immediately when disabled). */
  ready: boolean;
  session: Session | null;
  /** Starts the OAuth redirect; resolves with an error message instead of navigating away on failure. */
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Owns the Supabase session. On sign-in, seeds the local profile from the
 * Google identity (see profilePatchForUser). Must sit inside AppStateProvider. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { profile, setProfile } = useAppState();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(supabase === null);

  // The auth listener lives for the app's lifetime; reads go through refs so
  // the effect doesn't resubscribe on every state change.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const setProfileRef = useRef(setProfile);
  setProfileRef.current = setProfile;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_IN' && next) {
        const patch = profilePatchForUser(profileRef.current, next.user);
        if (patch) setProfileRef.current(patch);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const api = useMemo<AuthState>(
    () => ({
      enabled: supabase !== null,
      ready,
      session,
      signInWithGoogle: async () => {
        if (!supabase) return 'Sign-in is not configured in this build.';
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        return error ? error.message : null;
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [ready, session],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
