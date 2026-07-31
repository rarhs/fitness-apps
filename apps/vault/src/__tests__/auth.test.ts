/** Pure logic behind Google sign-in: reading the Supabase client config from
 * Vite env vars, and seeding the local profile from the signed-in Google user.
 * The browser-only pieces (supabase-js client, AuthProvider) are thin wrappers
 * over these and are exercised manually. */
import { describe, expect, it } from 'vitest';
import { profilePatchForUser, supabaseConfig } from '../auth';
import type { Profile } from '../state';

const profile = (over: Partial<Profile> = {}): Profile => ({
  name: 'Guest',
  email: '',
  units: 'kg',
  defaultRestSec: 90,
  memberSince: '2026-07-31T00:00:00.000Z',
  ...over,
});

describe('supabaseConfig', () => {
  it('returns null when nothing is set', () => {
    expect(supabaseConfig({})).toBeNull();
  });

  it('returns null when either var is missing', () => {
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toBeNull();
  });

  it('treats blank values as missing', () => {
    expect(
      supabaseConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }),
    ).toBeNull();
  });

  it('returns trimmed url and key when both are set', () => {
    expect(
      supabaseConfig({
        VITE_SUPABASE_URL: ' https://x.supabase.co ',
        VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_x ',
      }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'sb_publishable_x' });
  });
});

describe('profilePatchForUser', () => {
  it('seeds name and email on an untouched default profile', () => {
    const user = { email: 'rowan@example.com', user_metadata: { full_name: 'Rowan Park' } };
    expect(profilePatchForUser(profile(), user)).toEqual({
      name: 'Rowan Park',
      email: 'rowan@example.com',
    });
  });

  it('falls back from full_name to name in metadata', () => {
    const user = { email: 'rowan@example.com', user_metadata: { name: 'Rowan' } };
    expect(profilePatchForUser(profile(), user)).toEqual({
      name: 'Rowan',
      email: 'rowan@example.com',
    });
  });

  it('never overwrites a customised display name', () => {
    const user = { email: 'rowan@example.com', user_metadata: { full_name: 'Rowan Park' } };
    expect(profilePatchForUser(profile({ name: 'R.' }), user)).toEqual({
      email: 'rowan@example.com',
    });
  });

  it('treats a blank name like the default', () => {
    const user = { email: 'rowan@example.com', user_metadata: { full_name: 'Rowan Park' } };
    expect(profilePatchForUser(profile({ name: '  ' }), user)).toEqual({
      name: 'Rowan Park',
      email: 'rowan@example.com',
    });
  });

  it('omits the email when it already matches', () => {
    const user = { email: 'rowan@example.com', user_metadata: { full_name: 'Rowan Park' } };
    expect(profilePatchForUser(profile({ email: 'rowan@example.com' }), user)).toEqual({
      name: 'Rowan Park',
    });
  });

  it('returns null when there is nothing to change', () => {
    const user = { email: 'rowan@example.com', user_metadata: {} };
    expect(profilePatchForUser(profile({ name: 'R.', email: 'rowan@example.com' }), user)).toBeNull();
  });

  it('ignores non-string metadata values', () => {
    const user = { email: 'rowan@example.com', user_metadata: { full_name: 42, name: '' } };
    expect(profilePatchForUser(profile(), user)).toEqual({ email: 'rowan@example.com' });
  });

  it('handles a user without email or metadata', () => {
    expect(profilePatchForUser(profile({ name: 'R.' }), {})).toBeNull();
  });
});
