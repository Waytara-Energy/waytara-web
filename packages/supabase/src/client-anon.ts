import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { retryingFetch } from "./retry-fetch";
import type { Database } from "./types";

/**
 * A signed-out client that reads no cookies, for PUBLIC pages that must stay static and cacheable (a page that reads cookies becomes dynamic). It can
 * only do what the anon role may do: call the functions that were granted to anon, such as `list_authorized_partners`. The same `waytara` schema default
 * as the other clients. Never use it where a signed-in user's own client is needed.
 */
export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("[@waytara/supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createSupabaseClient<Database, "waytara">(supabaseUrl, supabaseAnonKey, {
    db: { schema: "waytara" },
    global: { fetch: retryingFetch },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
