import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@waytara/supabase/middleware";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { isCustomerRole } from "@waytara/supabase/roles";

// apps/web is customer-facing only: /dashboard requires a session AND a
// `customer` profile role — anyone else (no session, or a staff account)
// gets bounced back to /login, not just hidden behind a missing link.
export async function middleware(request: NextRequest) {
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
