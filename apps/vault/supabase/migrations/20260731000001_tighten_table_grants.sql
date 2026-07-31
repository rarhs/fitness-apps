-- Explicit table privileges. Without these the schema silently relies on the
-- hosted project's default privileges (which grant ALL to anon/authenticated);
-- a fresh stack (supabase start) has no such defaults, so the API roles get
-- nothing — the adapter contract tests caught this. Grants now match the RLS
-- policies exactly: no UPDATE on the append-only tables, and nothing at all
-- for anon (defense in depth on top of policy-level denial).

revoke all on table
  public.profiles,
  public.routines,
  public.sessions,
  public.saved_exercises
from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.routines to authenticated;
grant select, insert, delete on table public.sessions to authenticated;
grant select, insert, delete on table public.saved_exercises to authenticated;
