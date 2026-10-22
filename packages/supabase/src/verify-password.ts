import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Is this the password of this account? Signs in with a throwaway client that keeps nothing (no cookie, no stored session) and signs that
 * session out again at once (this device only), so checking a password before a sensitive change never replaces the person's own session or
 * leaves another one behind.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("[@waytara/supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const probe = createSupabaseClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await probe.auth.signOut({ scope: "local" });
  return true;
}
