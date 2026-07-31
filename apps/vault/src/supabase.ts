import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './auth';

const config = supabaseConfig(import.meta.env);

/** Shared supabase-js client, or null when the build has no
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — the app stays fully
 * usable without it (local-only, no sign-in). PKCE is the recommended OAuth
 * flow for browser SPAs; the code exchange on the redirect back happens
 * automatically because detectSessionInUrl defaults to true. */
export const supabase: SupabaseClient | null = config
  ? createClient(config.url, config.key, { auth: { flowType: 'pkce' } })
  : null;
