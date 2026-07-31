# Vault — Supabase backend

Backend for `apps/vault` sync: Supabase project **vault-app** (ref `wuxuavyomhoqxfqjjygp`, same org as workout-app). This database holds **user data only** — profiles, routines, sessions, saved exercises. The exercise catalogue never lives here; `exercise_ids` are text ids referencing the exercises-dataset on GitHub Pages.

## Layout

- `migrations/` — schema + RLS, one file per migration, mirrored 1:1 into the project's migration history (applied via the Supabase MCP `apply_migration` or the SQL editor; keep file and applied history in step).
- `tests/rls.test.sql` — the RLS test suite. Transactional and side-effect free (ends in `ROLLBACK`), so it is safe to run against the live project as `postgres` — via MCP `execute_sql`, the SQL editor, or psql. A failed invariant raises an exception naming it; the final `RLS tests passed` row means all checks passed. Re-run it after **any** change to tables or policies.

## Design decisions

- **Sessions are append-only**: clients get `select`/`insert`/`delete` policies but deliberately **no `update` policy** — a logged session is an immutable fact keyed by a client-generated UUID. The sync adapter must therefore upsert sessions with *ignore duplicates* (`ON CONFLICT DO NOTHING`), never `DO UPDATE`.
- **`updated_at_ms`** on profiles/routines is the client's last-write-wins clock (ms epoch, set by the app's mutations), not a server timestamp — the server never overwrites it.
- **One routine per user** for now (`user_id` is the primary key of `routines`), matching the app's single-routine model; going multi-routine later means a new keyed table and a migration.
- All policies are per-operation, `to authenticated`, with `(select auth.uid())` (cached per statement, not per row). `anon` has no policies and therefore no access.
