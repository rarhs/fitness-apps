-- Per-set logs on sessions: array-of-arrays aligned with exercise_ids
-- (sets[i] belongs to exercise_ids[i]); each entry is {reps, loadKg} with the
-- load normalised to kg at record-build time. Additive and backfill-free —
-- rows that predate this column keep '[]' and render aggregate-only. The
-- append-only policy set is untouched: sets arrive with the insert.
alter table public.sessions
  add column sets jsonb not null default '[]'::jsonb check (jsonb_typeof(sets) = 'array');
