import { createClient } from "@supabase/supabase-js";
import type { Database } from "@waytara/supabase/types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** The signed-in person's session lives in this browser only (supabase-js keeps it in local storage). Every query goes to the waytara schema. */
export const supabase = createClient<Database, "waytara">(SUPABASE_URL || "http://localhost", SUPABASE_ANON_KEY || "missing", {
  db: { schema: "waytara" },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
