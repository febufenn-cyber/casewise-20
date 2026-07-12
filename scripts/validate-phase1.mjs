import fs from "node:fs/promises";

const required = ["apps/api/src/index.ts","apps/api/src/routes/uploads.ts","apps/api/src/routes/internal.ts","apps/api/src/routes/sources.ts","apps/api/src/routes/deletion.ts","apps/api/src/queue.ts","processor/Dockerfile","processor/pipeline.py","supabase/migrations/202607120005_deletion_and_security.sql","docs/phase-1/exit-review.md"];
for (const file of required) await fs.access(new URL(`../${file}`, import.meta.url));

const wrangler = await fs.readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
for (const binding of ["EVIDENCE_BUCKET","INGESTION_QUEUE","dead_letter_queue"]) if (!wrangler.includes(binding)) throw new Error(`wrangler.toml missing ${binding}`);

const expectedMigrations = [
  "202607120001_phase1_foundation.sql",
  "202607120002_secure_uploads.sql",
  "202607120003_processing_pipeline.sql",
  "202607120004_provenance.sql",
  "202607120005_deletion_and_security.sql",
];
const migrations = (await fs.readdir(new URL("../supabase/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql"));
for (const migration of expectedMigrations) if (!migrations.includes(migration)) throw new Error(`Phase 1 migration missing: ${migration}`);
console.log("Phase 1 artifact inventory is complete.");
