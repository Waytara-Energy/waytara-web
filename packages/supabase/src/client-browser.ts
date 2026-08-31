"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Creates a Supabase client for Client Components.
 *
 * Every `.from()` / `.rpc()` call made on this client defaults to the
 * `waytara` schema instead of `public` — equivalent to calling
 * `.schema('waytara')` on every query, configured once here.
 */
export function createClient() {
  // Deliberately literal `process.env.NEXT_PUBLIC_*` references, not a
  // `requireEnv(name)` helper doing `process.env[name]` — Next only inlines
  // NEXT_PUBLIC_* vars into the client bundle when it can statically see the
  // exact literal being accessed. A dynamic bracket lookup can't be
  // inlined, so it silently evaluates to undefined in the browser no matter
  // what's actually set. Confirmed live: this was broken from the day
  // client-browser.ts was written (Task 5) until Task 10.1's
  // MonitoringPanel became the first real Client Component to use it.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[@waytara/supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in this app's .env.local (see .env.example)."
    );
  }

  return createBrowserClient<Database, "waytara">(supabaseUrl, supabaseAnonKey, {
    db: { schema: "waytara" },
  });
}
