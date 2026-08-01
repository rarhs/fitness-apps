-- Multi-routine schema: routines become a per-user collection keyed by
-- (user_id, id) instead of one singleton row per user.
--
-- The pre-existing row lands on the nil UUID via the temporary column
-- default — the same SEED_ROUTINE_ID every client's migrated legacy (or
-- seeded default) routine carries, so devices and server converge on one
-- identity without hashing. The default is dropped afterwards: clients
-- always supply ids.
--
-- deleted_at_ms is the client's tombstone clock (0 = live), symmetric with
-- updated_at_ms. Deletion is an UPDATE that sets it, so the table still has
-- no delete policy; tombstones are kept forever (pruning would let a stale
-- device resurrect them).

alter table public.routines
  add column id uuid not null default '00000000-0000-0000-0000-000000000000',
  add column deleted_at_ms bigint not null default 0;

alter table public.routines drop constraint routines_pkey;
alter table public.routines add primary key (user_id, id);

alter table public.routines alter column id drop default;
