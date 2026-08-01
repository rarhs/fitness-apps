# Spec: Multiple named routines

Status: agreed 2026-08-01, not started. Follow-up to the session-sets work (PR #12) and last-time prefills (PR #13).

**Priority: ship before the public MVP launch.** The app is being prepared for public release; this feature must land while the owner is still the only user, because its schema migration is breaking for old clients (see deploy coupling below). Post-launch it would require an expand/contract rollout instead.

## Goal

Replace the single per-user routine with a list of named routines (e.g. Push A / Pull A / Legs). One routine is "active" per device; the Builder manages the list; sessions keep running off the active routine. Deletion must sync correctly across devices — this is the first synced document that can be *removed*, so it needs tombstones (the append-only union that sessions use would resurrect deletes).

## Data model (client, `src/state.tsx`)

- `Routine` gains `id: string` and `deletedAt?: number` (ms-epoch tombstone; absent = live).
- `Persisted.routine: Routine` → `Persisted.routines: Routine[]` plus `activeRoutineId: string`.
- `activeRoutineId` is **device-local** (like `recents`/`prefs`): never merged, validated on load/hydrate to point at a live routine, falling back to the first live one. Each device can be "on" a different routine.
- The provider still exposes a derived `routine` (the active one), so `Session`, `Home`, `Detail`'s "add to routine", and the existing mutations (`setRoutine`, `addToRoutine`, `removeFromRoutine`) keep their signatures and operate on the active routine — call-site churn stays near zero.
- New mutations: `addRoutine` (fresh UUID, becomes active), `duplicateRoutine`, `deleteRoutine` (stamps `deletedAt` + `updatedAt`; guarded so the last live routine can't be deleted), `selectRoutine`. Tombstoned routines stay in the array (sync needs them) but are filtered from every UI read via a `liveRoutines` selector.

## Identity and the legacy migration

The existing routine has no id, and both the server row and each device's local copy must migrate to the *same* id or the merge unions them into duplicates. Solution: the migrated legacy routine — and the seeded default for fresh installs — gets the **nil UUID** (`00000000-0000-0000-0000-000000000000`) as a constant `SEED_ROUTINE_ID`. It's safe because routine rows become user-scoped composite keys (below), deterministic across devices with no hashing, and it makes a fresh device's untouched seed LWW-merge cleanly against the server's migrated row. New routines use `crypto.randomUUID()`.

`loadPersisted` migrates the old shape: `{routine}` → `{routines: [{...routine, id: SEED_ROUTINE_ID}], activeRoutineId: SEED_ROUTINE_ID}`.

## Merge semantics (`src/sync/merge.ts`)

`mergeRoutines`: union by id; when both sides have an id, per-id LWW on `updatedAt` (tie → remote), and a tombstone participates in LWW like any edit — newest write wins, so a delete beats an older edit and loses to a newer one. Local-only ids push if touched; remote-only ids are adopted. One extra rule: **a local untouched routine (`updatedAt` absent/0 — i.e. the seed nobody edited) is discarded when the remote contributes any routines**, extending today's "untouched default is never pushed" so a fresh device doesn't grow a ghost "Push A" beside the real list. `PushPlan.routine: boolean` → `routines: Routine[]`.

Tombstones are kept forever: rows are tiny, and pruning reintroduces resurrection from stale devices.

## Ops and backend (`src/sync/ops.ts`, `src/sync/rows.ts`, backends)

- `put-routine` op carries one identified routine; `opsForTransition` diffs `prev.routines`/`next.routines` by id (new or changed → one op each; a delete is just a changed doc). Queue replay stays idempotent because everything is an upsert.
- `RemoteState.routine: Routine | null` → `routines: Routine[]` (tombstones included in pulls — merge needs them). FakeBackend and SupabaseBackend follow; upsert conflict target becomes `(user_id, id)`.

## Schema (migration `multi_routines`)

```sql
alter table public.routines
  add column id uuid not null default '00000000-0000-0000-0000-000000000000',
  add column deleted_at_ms bigint not null default 0;
alter table public.routines drop constraint routines_pkey;
alter table public.routines add primary key (user_id, id);
alter table public.routines alter column id drop default;
```

The existing prod row lands on the nil id, matching every client's migrated copy. RLS policies are unchanged (all keyed on `user_id`; still no delete policy — deletion is an update). RLS suite gains a case asserting cross-user isolation under the composite PK; contract tests cover multi-row round-trips and tombstones.

**Deploy coupling**: after the PK change, an old client's routine upsert (conflict target `user_id`) fails. While the owner is still the only user this is trivial — merge, apply migration, Vercel deploys, reload open tabs in one sitting, same as the `add_session_sets` rollout. **This is why the slice must ship pre-launch**: with real users on old clients, the same change would need an expand/contract migration (dual conflict targets during a rollout window), which is complexity an MVP shouldn't buy. Treat this as the general rule for all post-launch migrations: additive changes (like `add_session_sets`) are safe; anything that breaks an in-flight old client needs a compatibility window.

## UI (Builder-centric, minimal)

- Builder gets a routine picker row above the editor: one chip per live routine + "New" and "Duplicate"; the name field already in the editor is the rename; a Delete button (disabled on the last routine). Selecting a chip sets the active routine.
- Home's start-session CTA already shows `routine.name` — now the active one. Session screen unchanged. Sessions/history pages unchanged.

## Optional follow-up (separate slice, not blocking)

- `SessionRecord.routineId?` + nullable `sessions.routine_id` column, snapshotting which routine produced a session — enables per-routine history/stats later.
- A first-run template gallery ("Push/Pull/Legs · Upper/Lower · Full Body · Start empty") — templates are just pre-built routines, so this slots naturally on top of multi-routines. Post-MVP.

## Slice plan (each its own red→green branch → PR)

1. **State model + migration** — `Routine.id`/`deletedAt`, `routines[]` + `activeRoutineId`, seed/legacy migration, new mutations, derived active `routine`, last-routine delete guard. Pure-logic tests in `state.test.ts`; UI components compile untouched because `routine` stays exposed. Also renames the seed routine `Push A` → **`Starter Push`**: for public users the seed is a disposable sample, not a program with opinions, and the name should say so. Because `Routine.id` is required, this slice also carries an **interim sync bridge** (deploys safely against the old schema): merge/ops handle exactly the nil-id routine — per-document LWW as before, a tombstoned winner is never pushed (the old schema cannot represent deletion; a strictly newer remote edit revives it), non-nil routines stay local-only, and `rowToRoutine` stamps the nil id on the singleton row. Slice 2 replaces the bridge with the real collection semantics.
2. **Merge + ops** — full collection semantics: union-by-id merge with per-id LWW (tombstones participate; deletions are pushed), `PushPlan.routines: Routine[]`, per-id `opsForTransition`/`planOps`, per-routine-id queue coalescing, FakeBackend collection state, re-seed when nothing live survives a merge (`withLiveRoutine`). The interim compatibility shim moves down into `SupabaseBackend` only: `putRoutine` drops non-nil/tombstoned documents (the old schema can't represent them) and `fetchState` wraps the singleton row as a one-element array — that guard is exactly what slice 3 deletes. Tests in `sync-merge`/`sync-wiring`/`sync-queue` + a contract test for the guard.
3. **Schema + adapter** — the migration above, `RoutineRow` changes, `(user_id, id)` upsert, tombstones in pulls; contract tests + RLS suite on the local stack (clean DB — its seed ids are fixed). Prod migration applied at merge/deploy time.
4. **Builder UI** — picker chips, new/duplicate/delete/select; small pure helper for copy-naming ("Push A copy"). Mostly UI, thin test surface.

## Defaults on the judgment calls

- `activeRoutineId` stays device-local (not synced).
- Tombstones kept forever.
- No cap on routine count.

All three are easy to revisit later.
