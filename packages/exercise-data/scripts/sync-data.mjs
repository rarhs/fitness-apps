#!/usr/bin/env node
// Regenerates src/generated/exercise-index.json — the slim, bundle-friendly
// exercise index (no instruction text) that apps import statically.
//
// Source resolution:
//   default → local sibling checkout ../exercises-dataset if present,
//             otherwise the published GitHub Pages URL
//   --url   → force the Pages URL (what's actually deployed)
//
// Run via `npm run sync-data` (repo root or packages/exercise-data).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DATASET = path.resolve(pkgRoot, '../../../exercises-dataset/data/exercises.json');
const DATASET_URL = 'https://rarhs.github.io/exercises-dataset/data/exercises.json';
const OUT_PATH = path.join(pkgRoot, 'src', 'generated', 'exercise-index.json');

const INDEX_FIELDS = [
  'id',
  'name',
  'category',
  'body_part',
  'equipment',
  'target',
  'muscle_group',
  'secondary_muscles',
  'media_id',
  'image',
  'gif_url',
];

async function loadDataset() {
  if (!process.argv.includes('--url') && existsSync(LOCAL_DATASET)) {
    console.log(`source: ${LOCAL_DATASET}`);
    return JSON.parse(await readFile(LOCAL_DATASET, 'utf8'));
  }
  console.log(`source: ${DATASET_URL}`);
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

const data = await loadDataset();
if (!Array.isArray(data) || data.length === 0) {
  throw new Error('dataset is not a non-empty JSON array');
}

for (const rec of data) {
  for (const field of INDEX_FIELDS) {
    if (!(field in rec)) {
      throw new Error(`record ${rec.id ?? '<no id>'} is missing "${field}"`);
    }
  }
}

const index = data
  .map((rec) => Object.fromEntries(INDEX_FIELDS.map((f) => [f, rec[f]])))
  .sort((a, b) => a.id.localeCompare(b.id));

await mkdir(path.dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(index, null, 1) + '\n', 'utf8');

const langs = Object.keys(data[0].instructions ?? {}).sort().join(', ');
console.log(`wrote ${path.relative(pkgRoot, OUT_PATH)}: ${index.length} exercises (dataset languages: ${langs})`);
