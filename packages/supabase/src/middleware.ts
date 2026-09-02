import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[@waytara/supabase] Missing ${name}. Set it in apps/web/.env.local (see .env.example).`
    );
  }
  return value;
}

/**
 * Creates a Supabase client for `proxy.ts`/`middleware.ts`, backed by the
 * request/response cookie jars instead of `next/headers` (which middleware
 * can't use).
 *
 * Returns the client and a `getResponse()` accessor — call it (not a plain
 * `response` value) *after* every auth call your middleware makes, and
 * return what it gives you. This used to return a plain `response` value
 * instead: since a token refresh only happens *inside* the auth call
 * (`getCurrentProfile()`/`getUser()`), which always runs after
 * `createMiddlewareClient()` has already returned, a plain value captured
 * `response` before any refresh could occur — so a refreshed session's
 * `Set-Cookie` was silently written onto an internal object the caller had
 * no way to see, and never reached the browser. Confirmed live: forcing an
 * expired access token through both apps' proxy.ts showed the *server-side*
 * render pick up the refresh correctly (it reads the mutated `request`),
 * but the response back to the browser carried no `Set-Cookie` at all —
 * with Supabase's default refresh-token rotation, the next request would
 * then present an already-rotated-out refresh token and fail outright,
 * logging the user out. `getResponse()` reads the same closure variable
 * live, so calling it after the auth call reflects any refresh that just
 * happened.
 *
 * @example
 * export async function proxy(request: NextRequest) {
 *   const { supabase, getResponse } = createMiddlewareClient(request);
 *   const profile = await getCurrentProfile(supabase);
 *   if (!profile || !["admin", "staff"].includes(profile.role)) {
 *     return NextResponse.redirect(new URL("/login", request.url));
 *   }
 *   return getResponse();
 * }
 */
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const supabase = createServerClient<Database, "waytara">(supabaseUrl, supabaseAnonKey, {
    db: { schema: "waytara" },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  return { supabase, getResponse: () => response };
}
