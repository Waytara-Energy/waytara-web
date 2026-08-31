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
 * Creates a Supabase client for `middleware.ts`, backed by the request/response
 * cookie jars instead of `next/headers` (which middleware can't use).
 *
 * Returns both the client and the `NextResponse` it wrote refreshed session
 * cookies onto — return that `response` (or copy its cookies onto your own)
 * from your middleware so the browser picks up the refreshed session.
 *
 * @example
 * export async function middleware(request: NextRequest) {
 *   const { supabase, response } = createMiddlewareClient(request);
 *   const profile = await getCurrentProfile(supabase);
 *   if (!profile || !["admin", "staff"].includes(profile.role)) {
 *     return NextResponse.redirect(new URL("/login", request.url));
 *   }
 *   return response;
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

  return { supabase, response };
}
