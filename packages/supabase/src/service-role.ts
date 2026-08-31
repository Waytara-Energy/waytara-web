import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[@waytara/supabase] Missing ${name}.`);
  }
  return value;
}

/**
 * Full-privilege client that bypasses RLS entirely. Server-only
 * (`SUPABASE_SERVICE_ROLE_KEY` is never `NEXT_PUBLIC_*`, so it can't reach
 * the client bundle) — use it ONLY for operations that legitimately need to
 * run before a session exists:
 *
 *   - verifying an invite token (employee_invites / customer_onboarding)
 *     for a visitor who isn't authenticated yet
 *   - provisioning the profiles/customers row immediately after
 *     `auth.admin.createUser()` during invite acceptance
 *
 * Never use this for anything a signed-in user's own `createClient()`
 * (from `./client-server`) could do under RLS instead.
 */
export function createServiceRoleClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient<Database, "waytara">(supabaseUrl, serviceRoleKey, {
    db: { schema: "waytara" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
