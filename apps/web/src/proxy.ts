import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@waytara/supabase/middleware";
import { profileForUser } from "@waytara/supabase/auth";
import { isCustomerRole } from "@waytara/supabase/roles";
import { firstPageHref, pageOfPath } from "@waytara/supabase/team";
import { OWNER_ACCESS, loadTeamAccess, teamAccessHeader } from "@/lib/team-access";
import { needsSecondFactor } from "@/lib/mfa";
import { logTiming, startStopwatch } from "@/lib/server-timing";

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
  const watch = startStopwatch();
  const { supabase, getResponse } = createMiddlewareClient(request);

  // Who is signed in: one trip to the auth server, which also notices a session that was ended elsewhere ("sign out other devices"), so this stays a real
  // check and not a read of the cookie. The profile and the onboarding stage only need that user's id, so they are fetched together: they used to be three
  // trips one after another, and every one of them goes to the database's region.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  watch.mark("auth");
  const [lookup, onboardingResult, teamAccess] = user
    ? await Promise.all([
        profileForUser(supabase, user.id),
        supabase.from("customer_onboarding").select("current_stage").eq("customer_id", user.id).maybeSingle(),
        // a team member's pages (an owner: everything). Asked together with the rest as if for a customer; anyone else is turned away below before it is used.
        loadTeamAccess(supabase, user.id, "customer").catch(() => OWNER_ACCESS),
      ])
    : [null, null, null];
  watch.mark("profile+onboarding");
  const profile = lookup?.status === "ok" ? lookup.profile : null;

  // A partner has no customer dashboard: they are sent to their own area.
  if (profile?.role === "partner") {
    const url = request.nextUrl.clone();
    url.pathname = "/partner/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

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

  // Two-factor sign-in: a session that has the password but not yet the code does not open the dashboard. Read from the session itself (no extra
  // round trip); if it cannot be read the request is let through rather than locking anyone out.
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (needsSecondFactor(aal)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login/verify";
      url.search = "";
      return NextResponse.redirect(url);
    }
  } catch {
    /* fall through */
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
  const onboarding = onboardingResult?.data ?? null;

  const isOnboarded = !onboarding || onboarding.current_stage === "install_completed";

  if (!isOnboarded && request.nextUrl.pathname !== "/dashboard/onboarding-status") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/onboarding-status";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A team member sees only the pages the owner gave them (the devices are held back by the database itself). Billing, Support, Application Settings and the account's
  // own data are never shared. Sent to the first page they have, or, for a download or data request, refused.
  const access = teamAccess ?? OWNER_ACCESS;
  if (access.kind === "member") {
    const path = request.nextUrl.pathname;
    if (path.startsWith("/api/")) {
      if (!(path.startsWith("/api/reports/") && access.pages.includes("reports"))) {
        return NextResponse.json({ success: false, error: "This is not part of the access you were given." }, { status: 403 });
      }
    } else {
      const page = pageOfPath(path);
      if (page === null || page === "owner" || !access.pages.includes(page)) {
        const url = request.nextUrl.clone();
        url.pathname = firstPageHref(access.pages);
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
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
  requestHeaders.set("x-waytara-team", teamAccessHeader(access));

  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  // How long the gate itself took, shown in the browser's Network > Timing, and logged when it was slow.
  watch.mark("rest");
  finalResponse.headers.set("Server-Timing", watch.header());
  logTiming(`proxy ${request.nextUrl.pathname}`, watch);
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
  matcher: ["/dashboard/:path*", "/api/reports/:path*", "/api/account/:path*"],
};
