import type { Profile } from './state';

export interface SupabaseClientConfig {
  url: string;
  key: string;
}

/** Read the Supabase client config from Vite env vars. `null` means this build
 * has no backend — the app then runs local-only and sign-in is unavailable. */
export function supabaseConfig(env: Record<string, string | undefined>): SupabaseClientConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

/** The slice of a Supabase auth user this app reads. Structural on purpose so
 * tests don't need supabase-js. */
export interface AuthUser {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

const metaString = (meta: Record<string, unknown> | undefined, key: string): string | null => {
  const v = meta?.[key];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
};

/** What sign-in should copy from the Google identity into the local profile.
 * The display name is seeded only while the profile still has the untouched
 * default — a name the user typed is never overwritten. Returns null when
 * nothing would change so callers can skip the updatedAt stamp entirely. */
export function profilePatchForUser(
  profile: Pick<Profile, 'name' | 'email'>,
  user: AuthUser,
): Partial<Profile> | null {
  const patch: Partial<Profile> = {};

  const current = profile.name.trim();
  const fromGoogle = metaString(user.user_metadata, 'full_name') ?? metaString(user.user_metadata, 'name');
  if ((current === '' || current === 'Guest') && fromGoogle) patch.name = fromGoogle;

  if (user.email && user.email !== profile.email) patch.email = user.email;

  return Object.keys(patch).length > 0 ? patch : null;
}
