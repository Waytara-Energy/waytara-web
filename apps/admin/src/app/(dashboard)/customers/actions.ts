"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { subscriptionPeriod } from "@/lib/subscription-period";

const RECORDABLE = ["active", "trialing"] as const;

/** Records a subscription for a customer: which plan, for how long from which day, and the payment reference. The database function checks
 *  that the caller is an admin again, and a renewal is simply another row (the customer's Billing page shows the latest). */
export async function recordSubscription(customerId: string, formData: FormData): Promise<void> {
  await requireAdmin();

  const planId = String(formData.get("planId") ?? "");
  const status = String(formData.get("status") ?? "active");
  const period = subscriptionPeriod(String(formData.get("start") ?? ""), Number(formData.get("months")));
  const ref = String(formData.get("ref") ?? "").trim().slice(0, 120);

  if (!planId) throw new Error("Choose a plan.");
  if (!(RECORDABLE as readonly string[]).includes(status)) throw new Error("Choose Active or Trial.");
  if (!period) throw new Error("Choose a start day and how long it runs.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_subscription", {
    p_customer: customerId,
    p_plan: planId,
    p_status: status as (typeof RECORDABLE)[number],
    p_start: period.start,
    p_end: period.end,
    p_ref: ref || undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/customers");
}

/** Cancels a subscription, or marks that a payment is due. */
export async function setSubscriptionStatus(subscriptionId: string, status: "cancelled" | "past_due" | "active"): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_subscription_status", { p_id: subscriptionId, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}
