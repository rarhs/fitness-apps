# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

An npm-workspaces monorepo for fitness apps built on the **exercises-dataset** (1,324 exercises, multilingual instructions, 180×180 media). Apps live in `apps/` (first app: `apps/vault`); shared code lives in `packages/`.

## Related repositories (siblings in `C:\Users\sagor\code`)

- **`../exercises-dataset`** — the data source of truth (fork of hasaneyldrm/exercises-dataset, pushed to rarhs/exercises-dataset). Its GitHub Pages deployment is a free static API:
  - `https://rarhs.github.io/exercises-dataset/data/exercises.json` (full dataset, ~14 MB)
  - `https://rarhs.github.io/exercises-dataset/images/<id>-<media_id>.jpg` and `videos/<id>-<media_id>.gif`
  - `…/setup.html` documents an alternative **self-hosted path** (unused by this monorepo today, relevant if an app ever wants exercises in its own DB, e.g. Supabase):
    - `#db-setup`: `CREATE TABLE exercises` schemas for SQL Server / PostgreSQL / MySQL / SQLite, plus an in-browser "Generate INSERT SQL" button that downloads all 1,324 INSERTs. The SQL schema flattens the JSON — one `instructions_<lang>` column per language, `secondary_muscles` as JSONB/JSON/text — and **drops `instruction_steps` and `media_id`**. `image`/`gif_url` keep the same relative paths, so `imageUrl()`/`gifUrl()` still work against a DB import.
    - `#api-integration`: snippets for `GET /exercises/:id`, `?page=&limit=`, `?category=&body_part=` — examples for an API **you'd host yourself** on top of that DB. GitHub Pages serves only static JSON + media; no such REST endpoints exist.
- **`../workout-app`** — the first app (a Next.js 16 + Supabase tracker in its `tracker/` subdir, pushed to rarhs/workout-app). It predates this monorepo and may migrate into `apps/` later; don't assume it's here.

## Commands

```powershell
npm install        # once, at the repo root (workspaces)
npm run sync-data  # regenerate the slim exercise index from the dataset
npm run check      # tsc --noEmit across all workspaces
npm test           # vitest across all workspaces
```

Root `check`/`test` go through **Turborepo** (`turbo.json`): unchanged workspaces are cache hits. `build` is cached too (outputs `dist/**`, `VITE_*` declared in `env` so process-env changes invalidate correctly), consumed by the `size` task — the **bundle-size gate** (`apps/vault/scripts/check-bundle-size.mjs`, run in CI as `npx turbo run size`): gzipped `dist/assets` must stay under budget, guarding the invariant that the full dataset is never bundled. If a task ever gains another env-var input, declare it in that task's `env` or its cache will serve stale results. No remote cache; CI persists `.turbo` via actions/cache.

**Sharp edge (verified empirically, turbo 2.10)**: turbo's file hashing only sees git-tracked files, so gitignored `.env` / `.env.local` changes do NOT invalidate the build cache — declaring them in `inputs` has no effect. Vercel and CI never use `.env` files, so deploys are safe; after editing `.env` locally, use `turbo run build --force`.

## packages/exercise-data

The shared data layer. Key design decisions:

- **Ships TypeScript source, no build step** — `exports` points at `src/index.ts`. Consuming apps must transpile it: Next.js needs `transpilePackages: ['@fitness-apps/exercise-data']` in `next.config`; Vite handles it out of the box. If a build step ever becomes necessary (e.g. a consumer that can't transpile TS, or publishing the package outside the workspace), tell the user explicitly before adding one — don't introduce it silently.
- **`src/generated/exercise-index.json` is generated AND committed** (by `npm run sync-data`) so clones work without syncing. Never edit it by hand; regenerate after any dataset change. It's the slim index — all record fields except instruction text — small enough to bundle.
- **The full dataset is never bundled.** Instruction text is fetched at runtime via `fetchFullDataset()` / `fetchExercise()` (in-memory cached) from the Pages URL.
- `sync-data` reads the local sibling checkout `../exercises-dataset/data/exercises.json` when present (fast, offline), else fetches the Pages URL; `--url` forces the deployed version.
- Media URLs are built with `imageUrl()` / `gifUrl()` from `DEFAULT_MEDIA_BASE` — media files are never copied into this repo or its apps.

## Licensing constraint (applies to every app)

Dataset structure and instruction text are MIT, but **all exercise media is © Gym Visual, redistributed with permission at 180×180 only**. Every app UI that displays exercise images/GIFs must show the attribution (`DATASET_ATTRIBUTION` export: `© Gym visual — https://gymvisual.com/`), and media must never be upscaled, re-hosted at higher resolution, or stripped of attribution.

## apps/vault

"Vault" — an exercise reference library, routine builder and session logger, implemented from the Claude Design doc *Vault - Exercise Library* (Nocturne design system, vendored at `apps/vault/src/styles/nocturne.css`). Vite + React SPA, client-only: routines, logged sessions, profile and preferences persist to localStorage; exercise media and instruction text load from the dataset's Pages deployment at runtime. Dev with `npm run dev --workspace @fitness-apps/vault`, build with `npm run build --workspace @fitness-apps/vault`. Routing uses `react-router` v8 (the package itself, not `react-router-dom`).

## Adding an app

Create `apps/<name>` as its own workspace package. Consume the data layer via `"@fitness-apps/exercise-data": "*"` in its dependencies (npm workspaces links it). Each app deploys independently (e.g. Vercel monorepo subdirectory).

## Conventions

- Never add Co-Authored-By to commit messages.
- Remote: https://github.com/rarhs/fitness-apps. `main` is protected by a ruleset (PRs required; green `check` AND `smoke` statuses required — `smoke` is the Momentic E2E suite against the PR's Vercel preview, so merges wait ~5 min for it; no force pushes or deletions). For every change: feature branch → PR → merge; never commit to `main` directly, and never merge a PR unless the user explicitly says to.
