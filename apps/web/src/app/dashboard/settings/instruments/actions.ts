"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { getSelectedDevice } from "@/lib/selected-device";
import { getSettingFields, validateBatteryCrossFields } from "@/lib/instrument-settings-catalog";
import { TOU_PROGRAM_COUNT, validateTouSlots, type TouSlot } from "@/lib/time-of-use";
import { PROPERTY_TYPE_LABELS, POWER_SOURCE_LABELS, type SiteAddress } from "@/lib/site-catalog";

const INSTRUMENTS_PATH = "/dashboard/settings/instruments";

// ---- Site Setting tab: edits `sites` (via the sites_customer_update_own
// RLS policy) and the selected device's own `label` — a classic <form
// action> + redirect, same shape as the rest of this app's forms, since
// it's one combined submit rather than ~25 independently-saved fields. ----

export async function updateSiteSetting(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // Device (and its site) resolved server-side from the same cookie every
  // other device-scoped page reads — never trusted from the form.
  const device = await getSelectedDevice();
  if (!device || !device.site) {
    redirect(`${INSTRUMENTS_PATH}?error=${encodeURIComponent("No device selected.")}`);
  }

  const siteName = String(formData.get("siteName") ?? "").trim();
  const propertyType = String(formData.get("propertyType") ?? "");
  const powerSourceCategory = String(formData.get("powerSourceCategory") ?? "");
  const deviceLabel = String(formData.get("deviceLabel") ?? "").trim();

  if (!siteName) {
    redirect(`${INSTRUMENTS_PATH}?error=${encodeURIComponent("Site name can't be empty.")}`);
  }
  if (!(propertyType in PROPERTY_TYPE_LABELS)) {
    redirect(`${INSTRUMENTS_PATH}?error=${encodeURIComponent("Invalid property type.")}`);
  }
  if (!(powerSourceCategory in POWER_SOURCE_LABELS)) {
    redirect(`${INSTRUMENTS_PATH}?error=${encodeURIComponent("Invalid power source category.")}`);
  }

  const address: SiteAddress = {
    line1: String(formData.get("addressLine1") ?? "").trim() || undefined,
    city: String(formData.get("addressCity") ?? "").trim() || undefined,
    state: String(formData.get("addressState") ?? "").trim() || undefined,
    pincode: String(formData.get("addressPincode") ?? "").trim() || undefined,
  };
  const hasAddress = Object.values(address).some(Boolean);

  const supabase = await createClient();

  const { error: siteError } = await supabase
    .from("sites")
    .update({
      name: siteName,
      property_type: propertyType as never,
      power_source_category: powerSourceCategory as never,
      address: hasAddress ? (address as never) : null,
    })
    .eq("id", device.site.id);

  if (siteError) {
    redirect(`${INSTRUMENTS_PATH}?error=${encodeURIComponent(siteError.message)}`);
  }

  const { error: deviceError } = await supabase
    .from("devices")
    .update({ label: deviceLabel || null })
    .eq("id", device.id);

  if (deviceError) {
    redirect(`${INSTRUMENTS_PATH}?error=${encodeURIComponent(deviceError.message)}`);
  }

  revalidatePath(INSTRUMENTS_PATH);
  revalidatePath("/dashboard/sites");
  revalidatePath("/dashboard", "layout"); // header switcher shows the device label
  redirect(`${INSTRUMENTS_PATH}?success=1`);
}

// ---- Basic/Battery/System Work Mode/Grid/Gen tabs: one setting per call,
// invoked directly from a client component (not a <form>) so saving one
// of ~25 fields doesn't redirect the whole page — mirrors selectDevice's
// direct-call pattern from the header switcher. ----

export async function updateDeviceSetting(
  settingKey: string,
  settingValue: string
): Promise<{ error: string } | { ok: true }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const device = await getSelectedDevice();
  if (!device) return { error: "No device selected." };

  const field = getSettingFields(device.deviceType?.code ?? "").find((f) => f.key === settingKey);
  if (!field) return { error: "Unknown setting." };

  const value = settingValue.trim();
  if (!value) return { error: "Value can't be empty." };

  if (field.type === "number") {
    const num = Number(value);
    if (
      Number.isNaN(num) ||
      (field.min !== undefined && num < field.min) ||
      (field.max !== undefined && num > field.max)
    ) {
      return { error: `${field.label} must be between ${field.min} and ${field.max}.` };
    }
  }
  if (field.type === "select" && !field.options?.some((o) => o.value === value)) {
    return { error: "Invalid option." };
  }
  if (field.type === "toggle" && value !== "true" && value !== "false") {
    return { error: "Invalid value." };
  }

  const supabase = await createClient();

  // Battery's Shutdown<Low<Restart / Float<Absorption<=Equalization rules
  // span multiple keys — device_settings is an append-only log of single
  // key writes, so the full proposed set has to be assembled here: latest
  // value per key, with this write's own value applied on top.
  if (field.category === "battery") {
    const { data: rows } = await supabase
      .from("device_settings")
      .select("setting_key, setting_value, ts")
      .eq("device_id", device.id)
      .eq("setting_category", "battery")
      .order("ts", { ascending: true });

    const current: Record<string, string> = {};
    for (const row of rows ?? []) current[row.setting_key] = row.setting_value;
    current[field.key] = value;

    const crossFieldError = validateBatteryCrossFields(current);
    if (crossFieldError) return { error: crossFieldError };
  }

  const { error } = await supabase.from("device_settings").insert({
    device_id: device.id,
    setting_category: field.category,
    setting_key: field.key,
    setting_value: value,
    unit: field.unit ?? null,
    source: "customer_dashboard",
    written_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath(INSTRUMENTS_PATH);
  return { ok: true };
}

// ---- System Work Mode's Time-of-Use sub-editor: saved as one set of 6
// rows, not per-field. ----

export async function updateTimeOfUse(slots: TouSlot[]): Promise<{ error: string } | { ok: true }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const device = await getSelectedDevice();
  if (!device) return { error: "No device selected." };

  if (!Array.isArray(slots) || slots.length !== TOU_PROGRAM_COUNT) {
    return { error: "Malformed schedule." };
  }

  const validationError = validateTouSlots(slots);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const rows = slots.map((slot) => ({
    device_id: device.id,
    setting_category: "system_work_mode",
    setting_key: `tou_prog${slot.index}`,
    setting_value: JSON.stringify({
      startTime: slot.startTime,
      powerW: slot.powerW,
      capacityPct: slot.capacityPct,
      chargeSource: slot.chargeSource,
      gridSellEnabled: slot.gridSellEnabled,
    }),
    unit: null,
    source: "customer_dashboard",
    written_by: profile.id,
  }));

  const { error } = await supabase.from("device_settings").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(INSTRUMENTS_PATH);
  return { ok: true };
}
