"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";

function toIntOrNull(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : Math.trunc(n);
}

function toNumberOrNull(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

function toJsonOrNull(raw: FormDataEntryValue | null): { value: unknown; error?: string } {
  const str = String(raw ?? "").trim();
  if (!str) return { value: null };
  try {
    return { value: JSON.parse(str) };
  } catch {
    return { value: null, error: "must be valid JSON" };
  }
}

function readServicePlanFields(formData: FormData) {
  const coveredItems = toJsonOrNull(formData.get("coveredItems"));
  if (coveredItems.error) return { ok: false as const, error: `Covered items ${coveredItems.error}.` };
  const paidExtras = toJsonOrNull(formData.get("paidExtras"));
  if (paidExtras.error) return { ok: false as const, error: `Paid extras ${paidExtras.error}.` };

  const name = String(formData.get("name") ?? "").trim();
  const deviceCategory = String(formData.get("deviceCategory") ?? "").trim();
  const durationMonths = toIntOrNull(formData.get("durationMonths"));
  const totalServicesIncluded = toIntOrNull(formData.get("totalServicesIncluded"));

  if (!name || !deviceCategory || durationMonths === null || totalServicesIncluded === null) {
    return { ok: false as const, error: "Name, device category, duration, and total services are required." };
  }

  return {
    ok: true as const,
    fields: {
      name,
      device_category: deviceCategory,
      duration_months: durationMonths,
      total_services_included: totalServicesIncluded,
      free_services_count: toIntOrNull(formData.get("freeServicesCount")) ?? 0,
      price_amount: toNumberOrNull(formData.get("priceAmount")),
      per_extra_service_price_amount: toNumberOrNull(formData.get("perExtraServicePriceAmount")),
      covered_items: coveredItems.value,
      paid_extras: paidExtras.value,
    },
  };
}

export async function createServicePlan(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = readServicePlanFields(formData);
  if (!result.ok) {
    throw new Error(result.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("service_plans").insert(result.fields as never);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/service-plans");
}

export async function updateServicePlan(planId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const result = readServicePlanFields(formData);
  if (!result.ok) {
    throw new Error(result.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("service_plans").update(result.fields as never).eq("id", planId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/service-plans");
}

// Attaches a plan to one device as its active contract — end_date is
// computed once from start_date + the plan's duration_months, then stored
// as a plain editable column (same "computed default, not generated"
// reasoning as equipment.warranty_end_date), not recalculated afterward.
export async function createServiceContract(formData: FormData): Promise<void> {
  await requireAdmin();
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const servicePlanId = String(formData.get("servicePlanId") ?? "").trim();
  const startDateRaw = String(formData.get("startDate") ?? "").trim();

  if (!deviceId || !servicePlanId || !startDateRaw) {
    throw new Error("Device, plan, and start date are required.");
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("service_plans")
    .select("duration_months")
    .eq("id", servicePlanId)
    .maybeSingle();

  if (!plan) {
    throw new Error("Plan not found.");
  }

  const startDate = new Date(startDateRaw);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + plan.duration_months, startDate.getDate());

  const { data: contract, error } = await supabase
    .from("service_contracts")
    .insert({
      device_id: deviceId,
      service_plan_id: servicePlanId,
      start_date: startDateRaw,
      end_date: endDate.toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !contract) {
    throw new Error(error?.message ?? "Failed to create contract.");
  }

  const { error: deviceError } = await supabase
    .from("equipment")
    .update({ service_id: contract.id })
    .eq("id", deviceId);

  if (deviceError) {
    throw new Error(deviceError.message);
  }

  revalidatePath("/service-plans");
}
