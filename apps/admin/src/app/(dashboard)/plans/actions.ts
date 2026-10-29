"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";

const FEATURE_KEYS = ["monitoring", "performance", "analytics", "reports", "instrument_settings"] as const;
const TAX_MODES = ["included", "excluded", "none"] as const;
const OFFER_TYPES = ["percent", "flat"] as const;
const OFFER_APPLIES = ["both", "monthly", "yearly"] as const;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** A number field: blank = null, anything else must be a finite number. */
function numberOrNull(formData: FormData, key: string, label: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  return n;
}

function pick<T extends string>(formData: FormData, key: string, allowed: readonly T[], label: string): T {
  const v = text(formData, key) as T;
  if (!allowed.includes(v)) throw new Error(`${label} is not a valid choice.`);
  return v;
}

export async function updatePlan(planId: string, formData: FormData): Promise<void> {
  await requireAdmin();

  const name = text(formData, "name");
  if (!name) throw new Error("The plan needs a name.");
  if (name.length > 40) throw new Error("The plan name can be at most 40 characters.");

  const priceMonthly = numberOrNull(formData, "priceMonthly", "Monthly price");
  if (priceMonthly === null || priceMonthly < 0) throw new Error("Monthly price must be a number, 0 or more.");
  const priceYearly = numberOrNull(formData, "priceYearly", "Yearly price");
  if (priceYearly !== null && priceYearly < 0) throw new Error("Yearly price can't be negative.");

  // "Unlimited devices" is a switch; a limit is only read when it is off.
  const unlimited = formData.get("unlimitedDevices") === "on";
  const maxDevicesRaw = unlimited ? null : numberOrNull(formData, "maxDevices", "Max devices");
  if (maxDevicesRaw !== null && (!Number.isInteger(maxDevicesRaw) || maxDevicesRaw < 1)) {
    throw new Error("Max devices must be a whole number, 1 or more (or switch on unlimited).");
  }

  const taxMode = pick(formData, "taxMode", TAX_MODES, "The GST setting");
  const gstRate = numberOrNull(formData, "gstRate", "GST rate") ?? 18;
  if (gstRate < 0 || gstRate > 100) throw new Error("The GST rate must be between 0 and 100.");

  const offerEnabled = formData.get("offerEnabled") === "on";
  const offerType = pick(formData, "offerType", OFFER_TYPES, "The offer type");
  const offerAppliesTo = pick(formData, "offerAppliesTo", OFFER_APPLIES, "The offer's price");
  const offerValue = numberOrNull(formData, "offerValue", "Offer amount") ?? 0;
  if (offerValue < 0) throw new Error("The offer amount can't be negative.");
  if (offerEnabled && offerValue <= 0) throw new Error("Give the offer an amount, or switch it off.");
  if (offerType === "percent" && offerValue > 100) throw new Error("A percent offer can be at most 100.");
  const offerValidUntilRaw = text(formData, "offerValidUntil");
  if (offerValidUntilRaw && !/^\d{4}-\d{2}-\d{2}$/.test(offerValidUntilRaw)) throw new Error("The offer's end date isn't a valid date.");

  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) features[key] = formData.get(`feature_${key}`) === "on";

  // one bullet point per line, at most ten
  const highlights = text(formData, "highlights")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (highlights.length > 10) throw new Error("A plan can list at most 10 highlights.");
  if (highlights.some((l) => l.length > 120)) throw new Error("A highlight can be at most 120 characters.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name,
      tagline: text(formData, "tagline") || null,
      badge: text(formData, "badge") || null,
      highlights,
      price_monthly: priceMonthly,
      price_yearly: priceYearly,
      max_devices: maxDevicesRaw,
      is_active: formData.get("isActive") === "on",
      features,
      tax_mode: taxMode,
      gst_rate: gstRate,
      offer_enabled: offerEnabled,
      offer_label: text(formData, "offerLabel") || null,
      offer_type: offerType,
      offer_value: offerValue,
      offer_applies_to: offerAppliesTo,
      offer_valid_until: offerValidUntilRaw || null,
    })
    .eq("id", planId);

  if (error) throw new Error(error.message);

  revalidatePath("/plans");
}
