import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[@waytara/supabase] Missing ${name}. Set it in this app's .env.local (see .env.example).`
    );
  }
  return value;
}

/**
 * Creates a Supabase client for Server Components, Server Actions, and
 * Route Handlers. Reads/writes the session via Next's `cookies()`.
 *
 * Defaults every `.from()` / `.rpc()` call to the `waytara` schema
 * (equivalent to calling `.schema('waytara')` on every query).
 *
 * Not for `middleware.ts` — Next's `cookies()` isn't available there.
 * Use `createMiddlewareClient` from `@waytara/supabase/middleware` instead.
 */
export async function createClient() {
  // `cookies()` must run before anything that could throw (like the env
  // checks below) — it's what tells Next this route needs request-time
  // rendering. Throw first and Next never gets that signal: it fails the
  // static prerender pass outright instead of deferring to a real request.
  const cookieStore = await cookies();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient<Database, "waytara">(supabaseUrl, supabaseAnonKey, {
    db: { schema: "waytara" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // `set` was called from a Server Component render, where cookies
          // can't be mutated. Safe to ignore as long as session refresh is
          // also happening in middleware.
        }
      },
    },
  });
}
