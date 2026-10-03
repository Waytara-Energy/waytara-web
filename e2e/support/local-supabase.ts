import { execSync } from "node:child_process";
import { join } from "node:path";

export interface LocalSupabase {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

/** Reads the local Supabase stack's URL and keys from the CLI. E2E tests only
 *  ever talk to this local stack (started by packages/supabase/scripts/local-db.mjs)
 *  — never to the linked production project. */
export function readLocalSupabase(): LocalSupabase {
  const out = execSync("npx supabase status -o env", {
    cwd: join(__dirname, "..", "..", "packages", "supabase"),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const get = (name: string) => {
    const m = out.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m"));
    if (!m) throw new Error(`Local Supabase is not running (missing ${name}). Run: node packages/supabase/scripts/local-db.mjs up`);
    return m[1];
  };
  const url = get("API_URL");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
    throw new Error(`Refusing to run E2E against a non-local Supabase: ${url}`);
  }
  return { url, anonKey: get("ANON_KEY"), serviceRoleKey: get("SERVICE_ROLE_KEY") };
}
