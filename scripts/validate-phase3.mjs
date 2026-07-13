import fs from 'node:fs/promises';

const required = [
  'packages/core/src/allegations.mjs',
  'packages/core/src/responses.mjs',
  'packages/core/src/evidence-support.mjs',
  'packages/core/src/contradictions.mjs',
  'packages/core/src/matter-matrix.mjs',
  'apps/api/src/routes/allegations.ts',
  'apps/api/src/routes/responses.ts',
  'apps/api/src/routes/evidence.ts',
  'apps/api/src/routes/contradictions.ts',
  'apps/api/src/routes/matrix.ts',
  'supabase/migrations/202607130011_allegations.sql',
  'supabase/migrations/202607130012_responses.sql',
  'supabase/migrations/202607130013_evidence_support.sql',
  'supabase/migrations/202607130014_contradictions_missing.sql',
  'supabase/migrations/202607130015_matter_matrix.sql',
  'docs/phase-3/README.md',
  'docs/phase-3/exit-review.md',
  'docs/phase-3/phase-4-handoff.md',
];
for (const path of required) await fs.access(new URL(`../${path}`, import.meta.url));
const migrations = await Promise.all(required.filter((path) => path.endsWith('.sql')).map((path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
const requiredTables = [
  'allegations','allegation_sources','responses','response_sources','allegation_response_links','allegation_response_searches',
  'evidence_items','proposition_evidence_links','contradiction_candidates','missing_information_items','matter_matrix_snapshots','matter_matrix_rows','matter_matrix_reviews',
];
const combined = migrations.join('\n');
for (const table of requiredTables) {
  if (!new RegExp(`create table public\\.${table}\\b`, 'i').test(combined)) throw new Error(`Phase 3 table missing: ${table}`);
  if (!new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(combined)) throw new Error(`Phase 3 RLS missing: ${table}`);
}
console.log(`Validated Phase 3 inventory: ${required.length} artifacts and ${requiredTables.length} protected tables.`);
