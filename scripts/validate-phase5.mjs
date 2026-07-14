import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const required = [
  'packages/core/src/narrative-support.mjs',
  'packages/core/src/narrative-support.d.mts',
  'packages/core/src/matter-overview.mjs',
  'packages/core/src/matter-overview.d.mts',
  'packages/core/src/response-planning.mjs',
  'packages/core/src/response-planning.d.mts',
  'packages/core/src/phase5-controls.mjs',
  'packages/core/src/phase5-controls.d.mts',
  'packages/core/src/phase5-evaluation.mjs',
  'packages/core/src/phase5-evaluation.d.mts',
  'apps/api/src/routes/narrative-support.ts',
  'apps/api/src/routes/matter-overviews.ts',
  'apps/api/src/routes/response-planning.ts',
  'apps/api/src/routes/phase5-controls.ts',
  'apps/api/src/routes/phase5-evaluations.ts',
  'supabase/migrations/202607140021_narrative_support.sql',
  'supabase/migrations/202607140022_matter_overviews.sql',
  'supabase/migrations/202607140023_response_planning.sql',
  'supabase/migrations/202607140024_phase5_controls.sql',
  'supabase/migrations/202607140025_phase5_evaluations.sql',
  'tests/narrative-support.test.mjs',
  'tests/matter-overview.test.mjs',
  'tests/response-planning.test.mjs',
  'tests/phase5-controls.test.mjs',
  'tests/phase5-evaluation.test.mjs',
  'docs/phase-5/README.md',
  'docs/phase-5/overview-contract.md',
  'docs/phase-5/response-planning-contract.md',
  'docs/phase-5/approval-export-contract.md',
  'docs/phase-5/evaluation-contract.md',
  'docs/phase-5/exit-review.md',
  'docs/phase-5/phase-6-handoff.md',
];

for (const path of required) await fs.access(new URL(path, root));

const migrationPaths = required.filter((path) => path.endsWith('.sql'));
const migrations = await Promise.all(migrationPaths.map((path) => fs.readFile(new URL(path, root), 'utf8')));
const combined = migrations.join('\n');
const requiredTables = [
  'narrative_support_sets','narrative_sentences','narrative_sentence_supports','narrative_sentence_reviews',
  'matter_overview_snapshots','matter_overview_sections','matter_overview_section_sentences','matter_overview_reviews',
  'response_plan_snapshots','response_plan_nodes','response_plan_node_supports','response_plan_dependencies','response_plan_reviews',
  'phase5_artifact_dependencies','phase5_approvals','phase5_invalidation_events','phase5_internal_export_packages','phase5_internal_export_items',
  'phase5_evaluation_runs','phase5_evaluation_items',
];
for (const table of requiredTables) {
  if (!new RegExp(`create table public\\.${table}\\b`, 'i').test(combined)) throw new Error(`Phase 5 table missing: ${table}`);
  if (!new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(combined)) throw new Error(`Phase 5 RLS missing: ${table}`);
}

const exportMigration = await fs.readFile(new URL('supabase/migrations/202607140024_phase5_controls.sql', root), 'utf8');
for (const invariant of [
  "classification text not null default 'internal_only' check (classification = 'internal_only')",
  'filing_ready boolean not null default false check (filing_ready = false)',
  'production_use_allowed boolean not null default false check (production_use_allowed = false)',
]) {
  if (!exportMigration.includes(invariant)) throw new Error(`Phase 5 export invariant missing: ${invariant}`);
}

const exitReview = await fs.readFile(new URL('docs/phase-5/exit-review.md', root), 'utf8');
if (!exitReview.includes('not authorized for confidential production use')) throw new Error('Phase 5 exit review must preserve the confidential-production block');
if (!exitReview.includes('Phase 6 may implement a provider-neutral authority-research architecture')) throw new Error('Phase 5 exit review must contain the Phase 6 repository-only boundary');

console.log(`Validated Phase 5 inventory: ${required.length} artifacts and ${requiredTables.length} protected tables.`);
