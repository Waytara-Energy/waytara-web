"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[@waytara/supabase] Missing ${name}. Set it in apps/web/.env.local (see .env.example).`
    );
  }
  return value;
}

/**
 * Creates a Supabase client for Client Components.
 *
 * Every `.from()` / `.rpc()` call made on this client defaults to the
 * `waytara` schema instead of `public` — equivalent to calling
 * `.schema('waytara')` on every query, configured once here.
 */
export function createClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createBrowserClient<Database, "waytara">(supabaseUrl, supabaseAnonKey, {
    db: { schema: "waytara" },
  });
}
