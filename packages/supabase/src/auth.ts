import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "./client-server";
import type { Database } from "./types";

export type Profile = Database["waytara"]["Tables"]["profiles"]["Row"];
export type Role = Profile["role"];

export type TypedSupabaseClient = SupabaseClient<Database, "waytara">;

/**
 * Returns the `profiles` row (including `role`) for the currently signed-in
 * user, or `null` if there's no session.
 *
 * Pass an existing client (e.g. from `createMiddlewareClient`) to reuse it;
 * otherwise a Server Component client is created via `next/headers` cookies —
 * which only works outside `middleware.ts`.
 */
export async function getCurrentProfile(
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

  return data;
}

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
