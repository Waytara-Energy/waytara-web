import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";

/** The subset of `profiles` every /dashboard page actually renders —
 *  deliberately not the full `Profile` row (created_at, deactivated_at,
 *  etc.), since proxy.ts already enforced those before this request ever
 *  reached here. */
export interface RequestProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

/**
 * This app's fast path for "who is signed in, on THIS request" —
 * proxy.ts (middleware, see src/proxy.ts) already ran the real
 * `auth.getUser()` network round trip plus a `profiles` lookup once for
 * every `/dashboard/*` request, before any Server Component here even
 * starts rendering. Calling `getCurrentProfile()` again during the render
 * pass repeats that exact network cost a second time on every single
 * sidebar navigation — `@waytara/supabase`'s own `cache()` wrapper dedupes
 * correctly *within* one render pass (layout + page share one call), but
 * middleware and the render are separate request boundaries it can't see
 * across, so this was doubling this app's single biggest source of
 * navigation latency.
 *
 * Reads what proxy.ts already forwarded via request headers instead of
 * re-fetching. Falls back to a real `getCurrentProfile()` call — paying
 * the network cost again — only if those headers are missing (e.g. a
 * render reached outside proxy.ts's matcher, or a test harness without
 * middleware), so this never silently shows the wrong user.
 *
 * `cache()`-wrapped like `getCurrentProfile()`/`getCustomerDevices()`: one
 * resolution per render pass no matter how many components call it.
 */
export const getRequestProfile = cache(async (): Promise<RequestProfile | null> => {
  const h = await headers();
  const id = h.get("x-waytara-profile-id");

  if (id) {
    return {
      id,
      full_name: decodeURIComponent(h.get("x-waytara-profile-name") ?? "") || null,
      email: decodeURIComponent(h.get("x-waytara-profile-email") ?? "") || null,
      avatar_url: decodeURIComponent(h.get("x-waytara-profile-avatar") ?? "") || null,
      role: h.get("x-waytara-profile-role") ?? "customer",
    };
  }

  const profile = await getCurrentProfile();
  return profile
    ? {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        role: profile.role,
      }
    : null;
});

/**
 * Same fast-path-over-header, fallback-to-a-real-query pattern as
 * `getRequestProfile()`, for the one other thing proxy.ts already computed
 * on every request: whether this customer has finished onboarding. The
 * fallback re-checks `customer_onboarding` directly rather than assuming
 * "true" — matching proxy.ts's own "missing row = onboarded" default, for
 * a customer whose profile also had to come from the fallback path.
 */
export const isRequestOnboarded = cache(async (): Promise<boolean> => {
  const h = await headers();
  const flag = h.get("x-waytara-onboarded");
  if (flag !== null) return flag === "1";

  const profile = await getRequestProfile();
  if (!profile) return true;

  const supabase = await createClient();
  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("current_stage")
    .eq("customer_id", profile.id)
    .maybeSingle();

  return !onboarding || onboarding.current_stage === "install_completed";
});
