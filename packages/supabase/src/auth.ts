import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "./client-server";
import type { Database } from "./types";
import type { Role } from "./roles";

export type Profile = Database["waytara"]["Tables"]["profiles"]["Row"];
export type { Role };

export type TypedSupabaseClient = SupabaseClient<Database, "waytara">;

/**
 * Returns the `profiles` row (including `role`) for the currently signed-in
 * user, or `null` if there's no session — including a revoked/deleted one.
 *
 * `deactivated_at` (set by revoking access or permanently deleting a staff
 * account, see apps/admin's Employees page) is checked here rather than at
 * every call site: the real block is the Supabase Auth ban on the account
 * (prevents a new sign-in/session-refresh at the identity-provider level),
 * but an already-issued access token stays technically valid until it
 * expires. Treating a deactivated profile as "no session" here closes that
 * window immediately, everywhere `getCurrentProfile`/`requireRole` is
 * already used — no per-page or per-proxy special-casing needed.
 *
 * Pass an existing client (e.g. from `createMiddlewareClient`) to reuse it;
 * otherwise a Server Component client is created via `next/headers` cookies —
 * which only works outside `middleware.ts`.
 *
 * Wrapped in React's `cache()` — every dashboard page calls this
 * independently (same convention as each page fetching its own gate/data
 * rather than threading it down from the layout), and the layout calls it
 * too. Without memoization that's `auth.getUser()`'s network round trip to
 * the Auth server, PLUS a `profiles` row fetch, repeated 2-3+ times on a
 * single page load. `cache()` dedupes by call signature for the lifetime
 * of one request/render pass — the no-args call every page actually makes
 * hits the network exactly once no matter how many components call it.
 */
export const getCurrentProfile = cache(async function getCurrentProfile(
  client?: TypedSupabaseClient
): Promise<Profile | null> {
  const supabase = client ?? (await createServerSupabaseClient());

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[@waytara/supabase] getCurrentProfile: profile lookup failed:", error.message);
    return null;
  }

  if (data.deactivated_at) {
    await supabase.auth.signOut();
    return null;
  }

  return data;
});

/**
 * Server Component / Server Action / Route Handler guard: redirects to
 * `/login` if there's no session, or to `/unauthorized` if the signed-in
 * user's `profiles.role` isn't one of `role`. Returns the profile otherwise.
 *
 * Not for `middleware.ts` — `next/navigation`'s `redirect()` only works in
 * the App Router render/action pipeline. In middleware, call
 * `getCurrentProfile(supabase)` yourself and return
 * `NextResponse.redirect(...)` on failure (see `createMiddlewareClient`'s
 * example in `@waytara/supabase/middleware`).
 */
export async function requireRole(
  role: Role | Role[],
  options?: { redirectTo?: string; unauthorizedTo?: string }
): Promise<Profile> {
  const allowed = Array.isArray(role) ? role : [role];
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(options?.redirectTo ?? "/login");
  }

  if (!allowed.includes(profile.role)) {
    redirect(options?.unauthorizedTo ?? "/unauthorized");
  }

  return profile;
}
