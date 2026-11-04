"use server";

import { createClient } from "@waytara/supabase/server";
import { requireCustomer } from "@waytara/supabase/auth";
import { getCustomerPlan } from "@/lib/customer-plan";
import { fetchEvSessionDetail, type EvSessionDetail } from "@/lib/ev-session-detail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One charge in full, for the Overview's detail view. Reads go through the signed-in person's own session, so the database's row rules
 *  (the owner of the site, or staff assigned to it) decide whether the charge exists for them at all. */
export async function getEvSessionDetail(sessionId: string): Promise<{ ok: true; detail: EvSessionDetail } | { ok: false; message: string }> {
  await requireCustomer();
  if (!UUID.test(sessionId)) return { ok: false, message: "This charge could not be found." };
  try {
    const [supabase, plan] = await Promise.all([createClient(), getCustomerPlan()]);
    const detail = await fetchEvSessionDetail(supabase, sessionId, plan?.tariffRatePerKwh ?? 8);
    return detail ? { ok: true, detail } : { ok: false, message: "This charge could not be found." };
  } catch {
    return { ok: false, message: "The details could not be loaded just now. Please try again." };
  }
}
