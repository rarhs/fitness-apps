-- RLS test suite for the vault-app Supabase project.
--
-- Self-contained and side-effect free: everything runs in one transaction
-- that ends in ROLLBACK, so it is safe to run against the live project
-- (via the Supabase MCP execute_sql, the SQL editor, or psql as postgres).
-- A failure raises an exception naming the broken invariant; reaching the
-- final SELECT means every check passed.
--
-- Invariants under test:
--   1. A user sees exactly their own rows in all four tables — including
--      every routine of their multi-routine collection, and none of anyone
--      else's.
--   2. A user can update their own profile/routines (per-id under the
--      composite (user_id, id) key, tombstoning included) but writes against
--      another user's rows affect 0 rows.
--   3. Session and routine inserts are only accepted for the caller's own
--      user_id; forging another user_id violates WITH CHECK.
--   4. Sessions are append-only for clients: no UPDATE policy exists, so
--      updates affect 0 rows even on the caller's own sessions.
--   5. A user may delete their own sessions and saved rows, but not others';
--      routines have no delete policy at all (deletion = tombstone update).
--   6. anon sees nothing and cannot write.

begin;

-- Synthetic users (discarded by the rollback).
insert into auth.users (id, email)
values
  ('a0000000-0000-4000-8000-00000000000a', 'rls-test-a@invalid.local'),
  ('b0000000-0000-4000-8000-00000000000b', 'rls-test-b@invalid.local');

-- Seed both users' data as postgres (owner bypasses RLS).
insert into public.profiles (user_id, name, email)
values
  ('a0000000-0000-4000-8000-00000000000a', 'User A', 'a@invalid.local'),
  ('b0000000-0000-4000-8000-00000000000b', 'User B', 'b@invalid.local');

insert into public.routines (user_id, id, name, rest_sec, items, updated_at_ms)
values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'Push A', 90, '[]'::jsonb, 1),
  ('a0000000-0000-4000-8000-00000000000a', 'aaaa1111-0000-4000-8000-000000000001', 'Pull A', 60, '[]'::jsonb, 1),
  ('b0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'Pull B', 60, '[]'::jsonb, 1);

insert into public.sessions (id, user_id, date, name, duration_sec, volume_kg, set_count, exercise_ids, regions)
values
  ('11111111-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', now(), 'Push A', 3000, 1000, 20, array['0025'], '{"chest": 20}'::jsonb),
  ('22222222-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000b', now(), 'Pull B', 3200, 1200, 18, array['0027'], '{"back": 18}'::jsonb);

insert into public.saved_exercises (user_id, exercise_id)
values
  ('a0000000-0000-4000-8000-00000000000a', '0025'),
  ('b0000000-0000-4000-8000-00000000000b', '0027');

-- ────────────────────────────── act as user A ──────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

do $$
declare n bigint;
begin
  -- 1. visibility: exactly own rows
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL profiles visibility: A sees % rows, expected 1', n; end if;
  select count(*) into n from public.routines;
  if n <> 2 then raise exception 'FAIL routines visibility: A sees % rows, expected 2 (own collection)', n; end if;
  select count(*) into n from public.sessions;
  if n <> 1 then raise exception 'FAIL sessions visibility: A sees % rows, expected 1', n; end if;
  select count(*) into n from public.saved_exercises;
  if n <> 1 then raise exception 'FAIL saved visibility: A sees % rows, expected 1', n; end if;
  select count(*) into n from public.sessions where user_id <> (select auth.uid());
  if n <> 0 then raise exception 'FAIL: A can see another user''s sessions'; end if;

  -- 2. own writes succeed; foreign writes hit 0 rows
  update public.profiles set name = 'User A edited' where user_id = (select auth.uid());
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A cannot update own profile'; end if;

  update public.routines set rest_sec = 120
  where user_id = (select auth.uid()) and id = '00000000-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A cannot update own routine by id'; end if;

  -- deletion is a tombstone update under the composite key
  update public.routines set deleted_at_ms = 99, updated_at_ms = 99
  where user_id = (select auth.uid()) and id = 'aaaa1111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A cannot tombstone own routine'; end if;

  update public.profiles set name = 'hacked' where user_id = 'b0000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A updated B''s profile'; end if;

  update public.routines set name = 'hacked' where user_id = 'b0000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A updated B''s routine'; end if;

  -- 3. inserts: own user_id ok, forged user_id rejected
  insert into public.routines (user_id, id, name, rest_sec, items, updated_at_ms)
  values ((select auth.uid()), 'aaaa2222-0000-4000-8000-000000000002', 'New day', 90, '[]'::jsonb, 2);

  begin
    insert into public.routines (user_id, id, name)
    values ('b0000000-0000-4000-8000-00000000000b', 'bbbb1111-0000-4000-8000-000000000001', 'forged routine');
    raise exception 'FAIL: A inserted a routine for B';
  exception
    when insufficient_privilege then null; -- expected: WITH CHECK violation
  end;

  insert into public.sessions (id, user_id, date, name, duration_sec, volume_kg, set_count, exercise_ids, regions)
  values ('33333333-0000-4000-8000-000000000003', (select auth.uid()), now(), 'mine', 60, 100, 1, array['0025'], '{"chest": 1}'::jsonb);

  begin
    insert into public.sessions (id, user_id, date, name, duration_sec, volume_kg, set_count, exercise_ids, regions)
    values ('44444444-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-00000000000b', now(), 'forged', 60, 100, 1, array['0025'], '{}'::jsonb);
    raise exception 'FAIL: A inserted a session for B';
  exception
    when insufficient_privilege then null; -- expected: WITH CHECK violation
  end;

  -- 4. sessions are append-only: denied either by the missing UPDATE grant
  -- (insufficient_privilege) or, failing that, by the absent policy (0 rows)
  begin
    update public.sessions set name = 'rewritten history';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: sessions are updatable (% rows) — append-only broken', n; end if;
  exception
    when insufficient_privilege then null; -- grant-level denial: even stronger
  end;

  -- 5. deletes: own rows only
  delete from public.sessions where id = '33333333-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A cannot delete own session'; end if;

  delete from public.sessions where id = '22222222-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A deleted B''s session'; end if;

  delete from public.saved_exercises where user_id = 'b0000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A deleted B''s saved rows'; end if;

  delete from public.saved_exercises where exercise_id = '0025';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A cannot delete own saved row'; end if;
end $$;

-- ────────────────────────────── act as anon ────────────────────────────────
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- anon must be denied either at the grant level (insufficient_privilege) or,
-- failing that, by having no policies (0 rows).
do $$
declare n bigint;
begin
  begin
    select count(*) into n from public.profiles;
    if n <> 0 then raise exception 'FAIL: anon sees profiles'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.routines;
    if n <> 0 then raise exception 'FAIL: anon sees routines'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.sessions;
    if n <> 0 then raise exception 'FAIL: anon sees sessions'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.saved_exercises;
    if n <> 0 then raise exception 'FAIL: anon sees saved rows'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.saved_exercises (user_id, exercise_id)
    values ('a0000000-0000-4000-8000-00000000000a', '9999');
    raise exception 'FAIL: anon inserted a row';
  exception
    when insufficient_privilege then null; -- expected: no grant and no policy
  end;
end $$;

rollback;

select 'RLS tests passed' as result;
