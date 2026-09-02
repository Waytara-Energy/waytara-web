import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@waytara/supabase/middleware";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { isCustomerRole } from "@waytara/supabase/roles";

// apps/web is customer-facing only: /dashboard requires a session AND a
// `customer` profile role — anyone else (no session, or a staff account)
// gets bounced back to /login, not just hidden behind a missing link.
//
// Next.js 16 deprecated middleware.ts in favor of proxy.ts (same behavior,
// renamed file/export) — confirmed live against apps/admin's identical
// setup that middleware.ts was silently never invoked at all in this
// version, so this file was renamed defensively for the same reason even
// though every /dashboard page here also independently checks
// getCurrentProfile() itself and redirects — this proxy is real
// defense-in-depth, not the only gate.
export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareClient(request);
  const profile = await getCurrentProfile(supabase);

  if (!profile || !isCustomerRole(profile.role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "error",
      profile
        ? "This app is for customer accounts only."
        : "Please sign in to continue."
    );
    return NextResponse.redirect(url);
  }

  // Onboarding pipeline redesign, Phase 6: the real dashboard (monitoring,
  // billing, everything under DashboardNav) only unlocks once installation
  // is complete — before that, every /dashboard/* route bounces to the
  // onboarding-status page instead. Doing this here rather than in
  // layout.tsx sidesteps two real problems: layouts can't read the
  // request's pathname (so they can't tell "already there, don't loop"),
  // and can't read searchParams either (which onboarding-status needs, to
  // show a failed-payment error back to the customer). A missing
  // customer_onboarding row is treated as onboarded — same reasoning as
  // the onboarding-status page itself: it shouldn't exist for a
  // pre-redesign customer, and blocking a real customer over a data gap
  // we can't explain would be worse than showing them their dashboard.
  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("current_stage")
    .eq("customer_id", profile.id)
    .maybeSingle();

  const isOnboarded = !onboarding || onboarding.current_stage === "install_completed";

  if (!isOnboarded && request.nextUrl.pathname !== "/dashboard/onboarding-status") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/onboarding-status";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Navigation-latency fix: everything above just paid for a real network
  // round trip to Supabase (auth.getUser() + a profiles row) plus a second
  // one for customer_onboarding — and every /dashboard/* page independently
  // re-fetches that exact same profile (getCurrentProfile()/
  // getRequestProfile() is cache()-deduped, but only *within* the
  // Server Component render pass; this middleware run is a separate request
  // boundary React's cache() can't see across). Without this, that meant
  // paying for auth.getUser()'s round trip TWICE on every single sidebar
  // click. Forwarding what was already fetched here as request headers lets
  // getRequestProfile() (apps/web/src/lib/request-profile.ts) skip the
  // second network round trip entirely for the common case, falling back to
  // a real fetch only if these headers are ever missing. encodeURIComponent
  // guards against non-Latin1 characters in full_name — raw header values
  // must stay ISO-8859-1.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-waytara-profile-id", profile.id);
  requestHeaders.set("x-waytara-profile-name", encodeURIComponent(profile.full_name ?? ""));
  requestHeaders.set("x-waytara-profile-email", encodeURIComponent(profile.email ?? ""));
  requestHeaders.set("x-waytara-profile-avatar", encodeURIComponent(profile.avatar_url ?? ""));
  requestHeaders.set("x-waytara-profile-role", profile.role);
  requestHeaders.set("x-waytara-onboarded", isOnboarded ? "1" : "0");

  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  // getResponse() — not a plain `response` value — because it has to be
  // called *after* getCurrentProfile()/the onboarding query above, so it
  // reflects a token refresh triggered by either of them (see
  // createMiddlewareClient's own doc comment: a stale snapshot here used to
  // silently drop refreshed session cookies, which combined with Supabase's
  // refresh-token rotation could log a real user out on their very next
  // request). This rebuild is only to attach the extra request headers on
  // top of it, not to replace it.
  getResponse()
    .cookies.getAll()
    .forEach((cookie) => finalResponse.cookies.set(cookie));
  return finalResponse;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
