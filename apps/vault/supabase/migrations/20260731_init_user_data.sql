-- Vault user data: profiles, routines, sessions, saved_exercises.
-- The exercise catalogue never lives in this database — exercise ids are text
-- references into the exercises-dataset served from GitHub Pages.
-- updated_at_ms columns carry the client's last-write-wins clock (ms epoch);
-- the server never writes them.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  units text not null default 'kg' check (units in ('kg', 'lb')),
  default_rest_sec integer not null default 90 check (default_rest_sec between 0 and 3600),
  member_since timestamptz not null default now(),
  updated_at_ms bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.routines (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Routine',
  rest_sec integer not null default 90 check (rest_sec between 0 and 3600),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at_ms bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key, -- client-generated: the append-only sync identity
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null,
  name text not null default '',
  duration_sec integer not null default 0 check (duration_sec >= 0),
  volume_kg numeric not null default 0 check (volume_kg >= 0),
  set_count integer not null default 0 check (set_count >= 0),
  exercise_ids text[] not null default '{}',
  regions jsonb not null default '{}'::jsonb check (jsonb_typeof(regions) = 'object'),
  created_at timestamptz not null default now()
);

create index sessions_user_id_date_idx on public.sessions (user_id, date desc);

create table public.saved_exercises (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.sessions enable row level security;
alter table public.saved_exercises enable row level security;

-- profiles: owner read/write (no delete — removal happens via account
-- deletion, which cascades from auth.users)
create policy profiles_select on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- routines: owner read/write
create policy routines_select on public.routines
  for select to authenticated using (user_id = (select auth.uid()));
create policy routines_insert on public.routines
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy routines_update on public.routines
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- sessions: append-only for clients — select/insert/delete, deliberately no
-- update policy. The adapter upserts with ON CONFLICT DO NOTHING.
create policy sessions_select on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy sessions_insert on public.sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy sessions_delete on public.sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- saved_exercises: the row is the fact — select/insert/delete, no update
create policy saved_select on public.saved_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy saved_insert on public.saved_exercises
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_delete on public.saved_exercises
  for delete to authenticated using (user_id = (select auth.uid()));
