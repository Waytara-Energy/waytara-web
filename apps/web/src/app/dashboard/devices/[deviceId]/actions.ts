"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { getCustomerSites, type CustomerDevice } from "@/lib/selected-site";
import { getSettingFields, validateBatteryCrossFields } from "@/lib/instrument-settings-catalog";
import { getModbusRegister } from "@/lib/modbus-register-map";
import { TOU_PROGRAM_COUNT, validateTouSlots, type TouSlot } from "@/lib/time-of-use";
import { PROPERTY_TYPE_LABELS, POWER_SOURCE_LABELS, POWER_PACKAGE_LABELS, type SiteAddress } from "@/lib/site-catalog";

// A site can have more than one device now, so there's no single
// cookie-resolved "current device" to trust the way there used to be —
// every action here takes an explicit deviceId (bound server-side from the
// page's own already-resolved device for the site.ts form, passed as a
// prop for the two direct-call actions) and re-resolves it against this
// customer's own sites/devices (RLS-scoped) before touching anything, the
// same don't-trust-the-client reasoning every other id-bearing action in
// this app already follows.
async function resolveOwnDevice(deviceId: string): Promise<CustomerDevice | null> {
  const sites = await getCustomerSites();
  for (const site of sites) {
    const device = site.devices.find((d) => d.id === deviceId);
    if (device) return device;
  }
  return null;
}

// ---- Site Setting tab: edits `sites` (via the update_device_site RPC)
// and the selected device's own `label` — a classic <form action> +
// redirect, same shape as the rest of this app's forms, since it's one
// combined submit rather than ~25 independently-saved fields. ----

export async function updateSiteSetting(deviceId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const devicePath = `/dashboard/devices/${deviceId}`;

  const device = await resolveOwnDevice(deviceId);
  if (!device) {
    redirect(`/dashboard/devices?error=${encodeURIComponent("No device selected.")}`);
  }

  const siteName = String(formData.get("siteName") ?? "").trim();
  const propertyType = String(formData.get("propertyType") ?? "");
  const powerSourceCategory = String(formData.get("powerSourceCategory") ?? "");
  const powerPackageRaw = String(formData.get("powerPackage") ?? "").trim();
  const deviceLabel = String(formData.get("deviceLabel") ?? "").trim();
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();

  if (!siteName) {
    redirect(`${devicePath}?error=${encodeURIComponent("Site name can't be empty.")}`);
  }
  if (!(propertyType in PROPERTY_TYPE_LABELS)) {
    redirect(`${devicePath}?error=${encodeURIComponent("Invalid property type.")}`);
  }
  if (!(powerSourceCategory in POWER_SOURCE_LABELS)) {
    redirect(`${devicePath}?error=${encodeURIComponent("Invalid power source category.")}`);
  }
  if (powerPackageRaw && !(powerPackageRaw in POWER_PACKAGE_LABELS)) {
    redirect(`${devicePath}?error=${encodeURIComponent("Invalid power package.")}`);
  }
  const powerPackage = powerPackageRaw || null;
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;

  const address: SiteAddress = {
    line1: String(formData.get("addressLine1") ?? "").trim() || undefined,
    city: String(formData.get("addressCity") ?? "").trim() || undefined,
    state: String(formData.get("addressState") ?? "").trim() || undefined,
    pincode: String(formData.get("addressPincode") ?? "").trim() || undefined,
  };
  const hasAddress = Object.values(address).some(Boolean);

  const supabase = await createClient();

  // Sites belong to a customer, not to any one device — several devices
  // can legitimately share one site (genuinely co-located installs), so a
  // plain `update` here would silently change every sibling device's
  // address too. This RPC only updates in place when the device is the
  // sole one on its site; otherwise it splits a fresh site off for just
  // this device, leaving siblings on the original untouched. See
  // 20260911000000_split_shared_site_on_customer_edit.sql.
  const { error: siteError } = await supabase.rpc("update_device_site", {
    p_device_id: device.id,
    p_name: siteName,
    p_property_type: propertyType as never,
    p_power_source_category: powerSourceCategory as never,
    p_address: hasAddress ? (address as never) : null,
    p_power_package: powerPackage as never,
    p_latitude: latitude ?? undefined,
    p_longitude: longitude ?? undefined,
  });

  if (siteError) {
    redirect(`${devicePath}?error=${encodeURIComponent(siteError.message)}`);
  }

  const { error: deviceError } = await supabase
    .from("devices")
    .update({ label: deviceLabel || null })
    .eq("id", device.id);

  if (deviceError) {
    redirect(`${devicePath}?error=${encodeURIComponent(deviceError.message)}`);
  }

  revalidatePath(devicePath);
  revalidatePath("/dashboard/devices");
  revalidatePath("/dashboard", "layout"); // header switcher shows the site's device count
  redirect(`${devicePath}?success=1`);
}

// ---- Per-category settings tabs: one setting per call, invoked directly
// from a client component (not a <form>) so saving one of many fields
// doesn't redirect the whole page — mirrors selectSite's direct-call
// pattern from the header switcher. ----

export async function updateDeviceSetting(
  deviceId: string,
  settingKey: string,
  settingValue: string
): Promise<{ error: string } | { ok: true }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const device = await resolveOwnDevice(deviceId);
  if (!device) return { error: "No device selected." };

  const field = getSettingFields(device.deviceType?.category ?? "").find((f) => f.key === settingKey);
  if (!field) return { error: "Unknown setting." };
  if (field.readOnly) return { error: `${field.label} is read-only.` };

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
    modbus_register: getModbusRegister(field.category, field.key) as never,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/devices/${deviceId}`);
  return { ok: true };
}

// ---- System Work Mode's Time-of-Use sub-editor: saved as one set of 6
// rows, not per-field. ----

export async function updateTimeOfUse(deviceId: string, slots: TouSlot[]): Promise<{ error: string } | { ok: true }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const device = await resolveOwnDevice(deviceId);
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
    modbus_register: getModbusRegister("system_work_mode", `tou_prog${slot.index}`) as never,
  }));

  const { error } = await supabase.from("device_settings").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/devices/${deviceId}`);
  return { ok: true };
}
