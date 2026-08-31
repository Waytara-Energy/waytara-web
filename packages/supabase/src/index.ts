// Barrel for types only. Client factories are intentionally *not*
// re-exported here — import them from their own entry points so a bundler
// can tell browser code (`./client`) apart from server-only code
// (`./server`, `./middleware`, `./auth`):
//
//   import { createClient } from "@waytara/supabase/client";     // Client Components
//   import { createClient } from "@waytara/supabase/server";     // Server Components / Actions / Route Handlers
//   import { createMiddlewareClient } from "@waytara/supabase/middleware";
//   import { getCurrentProfile, requireRole } from "@waytara/supabase/auth";
//   import { createServiceRoleClient } from "@waytara/supabase/service-role"; // server-only, bypasses RLS
//   import { STAFF_ROLES, isStaffRole, isCustomerRole } from "@waytara/supabase/roles";

export type { Database, Json } from "./types";
export type { Profile, TypedSupabaseClient } from "./auth";
export type { Role } from "./roles";
