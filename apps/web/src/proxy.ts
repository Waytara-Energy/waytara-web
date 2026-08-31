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

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
