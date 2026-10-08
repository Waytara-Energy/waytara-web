"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@waytara/supabase/auth";
import type { Json } from "@waytara/supabase/types";
import { createClient } from "@waytara/supabase/server";
import { INDIAN_STATES, TARIFF_CATEGORIES } from "@/lib/india-states";
import { parseSlabText, typicalRate, type Slab } from "@/lib/tariff-math";

function numberOrNull(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

const textOrNull = (raw: FormDataEntryValue | null) => String(raw ?? "").trim() || null;

// Adds a rate: one row per state, kind of property and date. A rate that is already in force is not edited - a new row with
// the date the new rate starts is added, so the history (and the daily job that tells customers about a change) stays true.
export async function saveTariff(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const state = String(formData.get("state") ?? "");
  const category = String(formData.get("category") ?? "");
  let rate = numberOrNull(formData.get("rate"));
  const exportRate = numberOrNull(formData.get("exportRate"));
  const fixedCharge = numberOrNull(formData.get("fixedCharge"));
  const billingMonths = Number(formData.get("billingMonths") ?? 1);
  const dutyPct = numberOrNull(formData.get("dutyPct")) ?? 0;
  const surcharge = numberOrNull(formData.get("surcharge")) ?? 0;
  const freeUnits = numberOrNull(formData.get("freeUnits")) ?? 0;
  const freeUnitsCap = numberOrNull(formData.get("freeUnitsCap"));
  const freeUnitsOverCap = numberOrNull(formData.get("freeUnitsOverCap")) ?? 0;
  const slabText = String(formData.get("slabs") ?? "").trim();
  let slabs: Slab[] | null = null;
  if (slabText) {
    const parsed = parseSlabText(slabText);
    if ("error" in parsed) throw new Error(parsed.error);
    slabs = parsed.slabs;
  }
  const effectiveFrom = String(formData.get("effectiveFrom") ?? "");
  const confidence = String(formData.get("confidence") ?? "indicative");
  const sourceUrl = textOrNull(formData.get("sourceUrl"));

  if (!(INDIAN_STATES as readonly string[]).includes(state)) throw new Error("Pick a state.");
  if (!(TARIFF_CATEGORIES as readonly string[]).includes(category)) throw new Error("Pick residential, commercial or industrial.");
  if (billingMonths !== 1 && billingMonths !== 2) throw new Error("A bill covers one or two months.");
  if (dutyPct < 0 || dutyPct > 50) throw new Error("Electricity duty must be between 0 and 50 %.");
  if (surcharge < 0 || surcharge > 20) throw new Error("The per-unit surcharge must be between 0 and 20.");
  if (freeUnits < 0 || freeUnits > 1000 || freeUnitsOverCap < 0 || (freeUnitsCap !== null && freeUnitsCap < 0)) throw new Error("Free units must be between 0 and 1000.");
  // With bands, the headline rate is worked out from them; with none, the rate typed is the single rate for every unit.
  if (slabs) rate = Math.round(typicalRate({ slabs, billingMonths, dutyPct, surchargePerKwh: surcharge }) * 100) / 100;
  if (rate === null || rate < 0 || rate > 100) throw new Error("Enter the rate in rupees per kWh (0 to 100), or the slab bands.");
  if (exportRate !== null && (exportRate < 0 || exportRate > 100)) throw new Error("The export rate must be between 0 and 100.");
  if (fixedCharge !== null && fixedCharge < 0) throw new Error("The fixed charge cannot be negative.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Enter the date the rate takes effect.");
  if (confidence !== "verified" && confidence !== "indicative") throw new Error("Pick verified or indicative.");
  if (confidence === "verified" && !sourceUrl) throw new Error("A verified rate needs the link to the regulator's order.");
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new Error("The source must be a web link starting with http.");

  const supabase = await createClient();
  const { error } = await supabase.from("electricity_tariffs").insert({
    state,
    category,
    rate_per_kwh: rate,
    export_rate_per_kwh: exportRate,
    fixed_charge_per_month: fixedCharge,
    slabs: slabs as unknown as Json | null,
    billing_months: billingMonths,
    duty_pct: dutyPct,
    surcharge_per_kwh: surcharge,
    free_units: freeUnits,
    free_units_cap: freeUnitsCap,
    free_units_over_cap: freeUnitsOverCap,
    effective_from: effectiveFrom,
    confidence,
    source_url: sourceUrl,
    source_note: textOrNull(formData.get("sourceNote")),
    created_by: profile.id,
  });
  if (error) {
    if (error.code === "23505") throw new Error("There is already a rate for that state, kind of property and date. Pick another date.");
    throw new Error(error.message);
  }
  revalidatePath("/tariffs");
}

// Only a rate that has not started yet can be taken back (a mistake in a scheduled change); a rate that has started is history.
export async function deleteScheduledTariff(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const today = new Date(new Date().getTime() + 19_800_000).toISOString().slice(0, 10);
  const { error } = await supabase.from("electricity_tariffs").delete().eq("id", id).gt("effective_from", today);
  if (error) throw new Error(error.message);
  revalidatePath("/tariffs");
}
