// Barrel for types only. Client factories are intentionally *not*
// re-exported here — import them from their own entry points so a bundler
// can tell browser code (`./client`) apart from server-only code
// (`./server`, `./middleware`, `./auth`):
//
//   import { createClient } from "@waytara/supabase/client";     // Client Components
//   import { createClient } from "@waytara/supabase/server";     // Server Components / Actions / Route Handlers
//   import { createMiddlewareClient } from "@waytara/supabase/middleware";
//   import { getCurrentProfile, requireRole } from "@waytara/supabase/auth";

export type { Database, Json } from "./types";
export type { Profile, Role, TypedSupabaseClient } from "./auth";
