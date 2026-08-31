import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@waytara/supabase/middleware";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { isStaffRole } from "@waytara/supabase/roles";

// Route prefixes only an `admin` profile may reach — an `employee` hitting
// one of these gets redirected to /unauthorized, not just a hidden nav item.
// Adjust this list as real pages land under each nav section.
const ADMIN_ONLY_PREFIXES = ["/employees", "/plans", "/devices"];

// Next.js 16 deprecated middleware.ts in favor of proxy.ts (same behavior,
// renamed file/export) — confirmed live: middleware.ts was silently never
// invoked at all in this version (an unauthenticated `fetch('/devices',
// {credentials:'omit'})` returned 200, not a redirect), so every route in
// this app was actually unprotected regardless of what this file said.
export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname } = request.nextUrl;
  const profile = await getCurrentProfile(supabase);

  // customer-role accounts are blocked entirely — apps/admin is staff-only.
  if (!profile || !isStaffRole(profile.role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "error",
      profile ? "This app is for staff accounts only." : "Please sign in to continue."
    );
    return NextResponse.redirect(url);
  }

  const isAdminOnlyRoute = ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isAdminOnlyRoute && profile.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/onboarding/:path*",
    "/customers/:path*",
    "/employees/:path*",
    "/plans/:path*",
    "/devices/:path*",
  ],
};
