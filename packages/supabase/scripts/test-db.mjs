// Runs every pgTAP file in supabase/tests/database against the local
// production-shaped database (see local-db.mjs) and exits non-zero if any
// assertion fails or a file errors out.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "tests", "database");
const CONTAINER = "supabase_db_waytara-local";
let failed = 0;
let total = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".test.sql")).sort()) {
  let out;
  try {
    out = execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=0 -At`, {
      input: readFileSync(join(dir, file)),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    console.error(`✗ ${file}: psql failed\n${out}`);
    failed++;
    continue;
  }
  const lines = out.split("\n");
  const ok = lines.filter((l) => /^ok \d+/.test(l)).length;
  const notOk = lines.filter((l) => /^not ok \d+/.test(l));
  const planned = Number((lines.find((l) => /^1\.\.\d+/.test(l)) ?? "1..0").slice(3));
  const errors = lines.filter((l) => /^ERROR:/.test(l));
  total += ok;
  if (notOk.length || errors.length || ok !== planned) {
    failed++;
    console.error(`✗ ${file}: ${ok}/${planned} passed`);
    [...notOk, ...errors].forEach((l) => console.error("   ", l));
  } else {
    console.log(`✓ ${file}: ${ok}/${planned} passed`);
  }
}

console.log(`\n${total} assertions passed${failed ? `, ${failed} file(s) FAILED` : ""}`);
process.exit(failed ? 1 : 0);
