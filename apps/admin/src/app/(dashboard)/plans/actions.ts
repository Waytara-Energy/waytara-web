"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";

const FEATURE_KEYS = ["monitoring", "performance", "analytics", "reports", "instrument_settings"] as const;

export async function updatePlan(planId: string, formData: FormData) {
  const priceMonthly = Number(formData.get("priceMonthly"));
  const priceYearlyRaw = String(formData.get("priceYearly") ?? "").trim();
  const maxDevicesRaw = String(formData.get("maxDevices") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!Number.isFinite(priceMonthly) || priceMonthly < 0) {
    redirect(`/plans?error=${encodeURIComponent("Monthly price must be a valid number.")}`);
  }

  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) {
    features[key] = formData.get(`feature_${key}`) === "on";
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      price_monthly: priceMonthly,
      price_yearly: priceYearlyRaw ? Number(priceYearlyRaw) : null,
      max_devices: maxDevicesRaw ? Number(maxDevicesRaw) : null,
      is_active: isActive,
      features,
    })
    .eq("id", planId);

  if (error) {
    redirect(`/plans?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/plans");
  redirect("/plans?success=1");
}
