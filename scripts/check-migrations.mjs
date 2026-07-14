import fs from "node:fs/promises";

const directory = new URL("../supabase/migrations/", import.meta.url);
const files = (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
if (files.length < 1) throw new Error("At least one migration is required");
const tables = [];
const rls = new Set();
for (const file of files) {
  const sql = await fs.readFile(new URL(file, directory), "utf8");
  for (const match of sql.matchAll(/create table public\.([a-z][a-z0-9_]*)/gi)) tables.push(match[1]);
  for (const match of sql.matchAll(/alter table public\.([a-z][a-z0-9_]*) enable row level security/gi)) rls.add(match[1]);
  if (!/\bbegin;/i.test(sql) || !/\bcommit;/i.test(sql)) throw new Error(`${file} must be transactional`);
}
const missing = tables.filter((table) => !rls.has(table));
if (missing.length) throw new Error(`RLS missing for: ${[...new Set(missing)].join(", ")}`);
console.log(`Validated ${files.length} migrations and ${tables.length} RLS-protected tables.`);
