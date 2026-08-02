// Bundle-size gate: the sum of gzipped dist/assets must stay under budget.
// Its real job is guarding a design invariant — the full exercises dataset
// (~14 MB) must never be bundled; only the slim generated index ships. A
// budget breach that isn't the dataset still deserves a deliberate decision.
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_KB = 256; // gzipped, all of dist/assets (current build: ~200 kB)

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');

let files;
try {
  files = readdirSync(assetsDir);
} catch {
  console.error(`No ${assetsDir} — run the build first (turbo runs it via dependsOn).`);
  process.exit(1);
}

let totalKb = 0;
for (const name of files.sort()) {
  const kb = gzipSync(readFileSync(join(assetsDir, name))).length / 1024;
  totalKb += kb;
  console.log(`  ${kb.toFixed(1).padStart(8)} kB gz  ${name}`);
}
console.log(`  ${totalKb.toFixed(1).padStart(8)} kB gz  total (budget ${BUDGET_KB} kB)`);

if (totalKb > BUDGET_KB) {
  console.error(
    `\nBundle exceeds the ${BUDGET_KB} kB gzipped budget. If this is the full dataset ` +
      'being bundled, fix the import (only the slim index ships). If growth is ' +
      'intentional, raise BUDGET_KB in this script with a justification in the PR.',
  );
  process.exit(1);
}
console.log('Bundle size OK.');
