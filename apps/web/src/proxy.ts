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
  const { supabase, response } = createMiddlewareClient(request);
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

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
