import { createClient } from "@supabase/supabase-js";
import { ACCOUNTS } from "./accounts";
import { readLocalSupabase } from "./local-supabase";

/** Creates (idempotently) the customer, admin and employee test users in the
 *  local Supabase, with matching profile rows. Runs once before all tests. */
export default async function globalSetup() {
  const sb = readLocalSupabase();
  const admin = createClient(sb.url, sb.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "waytara" },
  });

  for (const a of Object.values(ACCOUNTS)) {
    const { error: createError } = await admin.auth.admin.createUser({
      id: a.id,
      email: a.email,
      password: a.password,
      email_confirm: true,
    });
    // "already registered" on re-runs is fine; anything else is a real failure.
    if (createError && !/already|exists|registered/i.test(createError.message)) {
      throw new Error(`Could not create ${a.email}: ${createError.message}`);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: a.id, email: a.email, role: a.role, full_name: a.fullName });
    if (profileError) throw new Error(`Could not upsert profile for ${a.email}: ${profileError.message}`);
  }

  const { error: customerError } = await admin.from("customers").upsert({ id: ACCOUNTS.customer.id });
  if (customerError) throw new Error(`Could not upsert customer row: ${customerError.message}`);
}
