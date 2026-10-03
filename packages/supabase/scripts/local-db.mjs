// Brings up a local Supabase that mirrors production, for migration, RLS and
// end-to-end testing — never touches the linked (production) project.
//
//   node scripts/local-db.mjs up      start Docker stack, load baseline, apply newer migrations
//   node scripts/local-db.mjs reset   same, but from a clean database
//   node scripts/local-db.mjs down    stop the stack
//
// Why a baseline: the migration history can't be replayed on an empty
// database (the earliest migrations assume a `waytara` schema that was
// created outside them). `supabase/local/baseline-*.sql` are read-only dumps
// of production taken at BASELINE_VERSION; every migration after that
// version is applied on top, which also makes this the dry run for any new
// migration before it reaches production.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, renameSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sb = join(root, "supabase");
const migrations = join(sb, "migrations");
const hold = join(sb, ".migrations-hold");
// Last migration already contained in the baseline dumps.
const BASELINE_VERSION = "20261001010000";

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });
const cmd = process.argv[2] ?? "up";

if (cmd === "down") {
  run("npx supabase stop --no-backup");
  process.exit(0);
}

if (cmd === "reset") {
  try { run("npx supabase stop --no-backup"); } catch {}
}

// Start the stack with an empty migrations folder (see header), then restore it.
renameSync(migrations, hold);
try {
  mkdirSync(migrations);
  // PostgREST is configured to expose `waytara`, so the schema must exist
  // before the stack's health checks run; the baseline fills it in later.
  writeFileSync(join(migrations, "00000000000000_bootstrap.sql"), "create schema if not exists waytara;\n");
  run("npx supabase start");
} finally {
  rmSync(migrations, { recursive: true, force: true });
  renameSync(hold, migrations);
}

// psql inside the DB container: `supabase db query` only takes a single
// statement, but dumps and migrations are multi-statement scripts.
const DB_CONTAINER = "supabase_db_waytara-local";
const apply = (file) =>
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    input: readFileSync(file),
    stdio: ["pipe", "inherit", "inherit"],
  });
apply(join(sb, "local", "baseline-waytara.sql"));
apply(join(sb, "local", "baseline-storage.sql"));

const newer = readdirSync(migrations)
  .filter((f) => f.endsWith(".sql") && f.slice(0, 14) > BASELINE_VERSION)
  .sort();
for (const f of newer) {
  console.log(`\n→ applying ${f}`);
  apply(join(migrations, f));
}
console.log("\nLocal database ready.");
