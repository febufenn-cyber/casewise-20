import fs from 'node:fs/promises';

const required = [
  'packages/core/src/segmentation.mjs',
  'packages/core/src/entity-resolution.mjs',
  'packages/core/src/critical-facts.mjs',
  'packages/core/src/event-assertions.mjs',
  'packages/core/src/chronology.mjs',
  'apps/api/src/routes/documents.ts',
  'apps/api/src/routes/entities.ts',
  'apps/api/src/routes/facts.ts',
  'apps/api/src/routes/events.ts',
  'apps/api/src/routes/chronology.ts',
  'supabase/migrations/202607120006_document_segmentation.sql',
  'supabase/migrations/202607120007_entities.sql',
  'supabase/migrations/202607120008_critical_facts.sql',
  'supabase/migrations/202607120009_event_assertions.sql',
  'supabase/migrations/202607120010_disputed_chronology.sql',
];
for (const path of required) await fs.access(new URL(`../${path}`, import.meta.url));
const migrations = await Promise.all(required.filter((path) => path.endsWith('.sql')).map((path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
const requiredTables = ['segmentation_versions','entities','entity_mentions','date_mentions','amount_mentions','document_references','event_assertions','candidate_events','review_tasks','object_revisions','chronology_snapshots'];
const combined = migrations.join('\n');
for (const table of requiredTables) {
  if (!new RegExp(`create table public\\.${table}\\b`, 'i').test(combined)) throw new Error(`Phase 2 table missing: ${table}`);
  if (!new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(combined)) throw new Error(`Phase 2 RLS missing: ${table}`);
}
console.log(`Validated Phase 2 inventory: ${required.length} artifacts and ${requiredTables.length} protected tables.`);
