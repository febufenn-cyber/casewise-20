import fs from 'node:fs/promises';

const required = [
  'packages/core/src/filing-versions.mjs',
  'packages/core/src/delta-matching.mjs',
  'packages/core/src/filing-deltas.mjs',
  'packages/core/src/matter-memory.mjs',
  'packages/core/src/delta-evaluation.mjs',
  'apps/api/src/routes/filing-versions.ts',
  'apps/api/src/routes/delta-matching.ts',
  'apps/api/src/routes/filing-deltas.ts',
  'apps/api/src/routes/matter-memory.ts',
  'apps/api/src/routes/delta-evaluations.ts',
  'supabase/migrations/202607130016_filing_versions.sql',
  'supabase/migrations/202607130017_delta_matching.sql',
  'supabase/migrations/202607130018_filing_deltas.sql',
  'supabase/migrations/202607130019_matter_memory.sql',
  'supabase/migrations/202607130020_delta_evaluations.sql',
  'docs/phase-4/README.md',
  'docs/phase-4/matching-contract.md',
  'docs/phase-4/delta-classification-contract.md',
  'docs/phase-4/matter-memory-contract.md',
  'docs/phase-4/evaluation-contract.md',
  'docs/phase-4/exit-review.md',
  'docs/phase-4/phase-5-handoff.md',
];

for (const path of required) await fs.access(new URL(`../${path}`, import.meta.url));
const migrationPaths = required.filter((path) => path.endsWith('.sql'));
const migrations = await Promise.all(migrationPaths.map((path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
const combined = migrations.join('\n');
const requiredTables = [
  'filing_versions','filing_version_members','filing_version_reviews',
  'delta_match_runs','delta_match_candidates','delta_match_reviews',
  'delta_snapshots','delta_items','delta_item_reviews','delta_snapshot_reviews',
  'matter_memory_snapshots','matter_memory_entries',
  'delta_evaluation_runs','delta_evaluation_items',
];
for (const table of requiredTables) {
  if (!new RegExp(`create table public\\.${table}\\b`, 'i').test(combined)) throw new Error(`Phase 4 table missing: ${table}`);
  if (!new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(combined)) throw new Error(`Phase 4 RLS missing: ${table}`);
}
const workflow = await fs.readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
if (!workflow.includes('npm run validate:phase4')) throw new Error('Phase 4 CI validation step missing');
console.log(`Validated Phase 4 inventory: ${required.length} artifacts and ${requiredTables.length} protected tables.`);
