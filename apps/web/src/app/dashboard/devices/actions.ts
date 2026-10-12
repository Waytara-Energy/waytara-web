"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { requireCustomer } from "@waytara/supabase/auth";
import { getCustomerSites, type CustomerDevice } from "@/lib/selected-site";
import { getSettingFields } from "@/lib/instrument-settings-catalog";
import { hhmmToTime, parseBool, sameValue } from "@/lib/setting-values";
import type { SiteAddress } from "@/lib/site-catalog";

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

// ---- Site tab: one save for the whole card. Edits `sites` (via the update_device_site RPC: name, address, map position) and the selected
// device's own `label`, called directly from the client card. The property type, power source and power package are WayTara staff's to
// change, never sent from here: the site's own values go through unchanged (and the database refuses a customer who tries some other way).

export interface SiteSaveInput {
  siteName: string;
  deviceLabel: string;
  /** The map position to save; null leaves the site's position as it is. */
  latitude: number | null;
  longitude: number | null;
  address: { line1: string; city: string; state: string; pincode: string };
}

export async function saveSite(deviceId: string, input: SiteSaveInput): Promise<void> {
  await requireCustomer();

  const sites = await getCustomerSites();
  const site = sites.find((s) => s.devices.some((d) => d.id === deviceId));
  const device = site?.devices.find((d) => d.id === deviceId);
  if (!site || !device) throw new Error("No device selected.");

  const siteName = (input.siteName ?? "").trim().slice(0, 120);
  const deviceLabel = (input.deviceLabel ?? "").trim().slice(0, 120);
  if (!siteName) throw new Error("Site name can't be empty.");

  const { latitude, longitude } = input;
  if ((latitude === null) !== (longitude === null)) throw new Error("That location is not valid.");
  if (latitude !== null && longitude !== null && (!(latitude >= -90 && latitude <= 90) || !(longitude >= -180 && longitude <= 180))) throw new Error("That location is not valid.");

  const text = (v: string | null | undefined) => (v ?? "").trim().slice(0, 200);
  const pincode = text(input.address?.pincode);
  if (pincode !== "" && !/^\d{6}$/.test(pincode)) throw new Error("The PIN code must be 6 digits.");
  const address: SiteAddress = { line1: text(input.address?.line1) || undefined, city: text(input.address?.city) || undefined, state: text(input.address?.state) || undefined, pincode: pincode || undefined };
  const hasAddress = Object.values(address).some(Boolean);

  const supabase = await createClient();

  // Sites belong to a customer, not to any one device — several devices can legitimately share one site (genuinely co-located installs), so
  // a plain `update` would silently change every sibling device's address too. This RPC only updates in place when the device is the sole
  // one on its site; otherwise it splits a fresh site off for just this device. See 20260911000000_split_shared_site_on_customer_edit.sql.
  const { error: siteError } = await supabase.rpc("update_device_site", {
    p_device_id: device.id,
    p_name: siteName,
    p_property_type: site.propertyType as never,
    p_power_source_category: site.powerSourceCategory as never,
    p_address: hasAddress ? (address as never) : null,
    p_power_package: site.powerPackage as never,
    p_latitude: latitude ?? undefined,
    p_longitude: longitude ?? undefined,
  });
  if (siteError) throw new Error(siteError.message);

  const { error: deviceError } = await supabase.from("equipment").update({ label: deviceLabel || null }).eq("id", device.id);
  if (deviceError) throw new Error(deviceError.message);

  revalidatePath("/dashboard/devices");
  revalidatePath("/dashboard", "layout"); // the header shows the site and device names
}

// ---- Per-category settings tabs: one setting per call, invoked directly
// from a client component (not a <form>) so saving one of many fields
// doesn't redirect the whole page — mirrors selectSite's direct-call
// pattern from the header switcher. ----

export async function updateDeviceSetting(deviceId: string, settingKey: string, settingValue: string): Promise<void> {
  const profile = await requireCustomer();

  const device = await resolveOwnDevice(deviceId);
  if (!device) throw new Error("No device selected.");

  const field = getSettingFields(device.deviceType?.category ?? "").find((f) => f.key === settingKey);
  if (!field) throw new Error("Unknown setting.");
  if (field.readOnly) throw new Error(`${field.label} is read-only.`);

  const value = settingValue.trim();
  if (!value) throw new Error("Value can't be empty.");

  if (field.type === "number") {
    const num = Number(value);
    if (
      Number.isNaN(num) ||
      (field.min !== undefined && num < field.min) ||
      (field.max !== undefined && num > field.max)
    ) {
      throw new Error(`${field.label} must be between ${field.min} and ${field.max}.`);
    }
  }
  if (field.type === "select" && !field.options?.some((o) => o.value === value)) {
    throw new Error("Invalid option.");
  }
  if (field.type === "toggle" && value !== "true" && value !== "false") {
    throw new Error("Invalid value.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("equipment_configs").insert({
    equipment_id: device.id,
    setting_category: field.category,
    key_name: field.key,
    setting_value: value,
    unit: field.unit ?? null,
    source: "customer_dashboard",
    written_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/devices");
}

// ---- Catalog-driven raw field settings — every module page's Settings
// tab, whatever device_category equipment_templates covers. A field only
// reaches this action if this device's own equipment_metrics has it
// mapped with direction='write' and show_for_user=true — see
// fetchDeviceSettingFields, which is what actually renders the row this
// action gets called from. equipment_templates no longer carries a
// min_role/regulated distinction (that was collapsed into the workbook's
// own curation — every write-direction row shown to a customer is
// already meant to be customer-editable, no further role/confirmation
// gate needed here). ----

function validateSettingValue(
  field: { valueKind: string; validMin: number | null; validMax: number | null },
  enumCodes: string[] | undefined,
  value: string
): string | null {
  switch (field.valueKind) {
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return "Must be a number.";
      if (field.validMin !== null && n < field.validMin) return `Must be at least ${field.validMin}.`;
      if (field.validMax !== null && n > field.validMax) return `Must be at most ${field.validMax}.`;
      return null;
    }
    case "bool":
      // On and off arrive as true or false; the agent also writes 1 and 0.
      return parseBool(value) === null ? "Invalid value." : null;
    case "time":
      // A time is kept as hour-and-minute digits (100 is 01:00).
      return hhmmToTime(value) === null ? "Must be a time of day." : null;
    case "enum":
      return enumCodes?.includes(value) ? null : "Invalid option.";
    default:
      return value.trim() ? null : "Value can't be empty.";
  }
}

export async function updateInstrumentSetting(deviceId: string, key: string, value: string): Promise<void> {
  const profile = await requireCustomer();

  const device = await resolveOwnDevice(deviceId);
  if (!device) throw new Error("No device selected.");

  const supabase = await createClient();

  const { data: metric } = await supabase
    .from("equipment_metrics")
    .select("category, direction, enum_ref, valid_min, valid_max, show_for_user, equipment_templates!inner(display_name, unit, value_kind)")
    .eq("equipment_id", device.id)
    .eq("key_name", key)
    .maybeSingle();

  if (!metric || metric.direction !== "write" || !metric.show_for_user) {
    throw new Error("Unknown setting.");
  }
  const template = metric.equipment_templates;

  let enumCodes: string[] | undefined;
  if (template.value_kind === "enum" && metric.enum_ref) {
    const { data: enumRows } = await supabase.from("equipment_enum").select("code").eq("enum_ref", metric.enum_ref);
    enumCodes = (enumRows ?? []).map((r) => r.code);
  }

  const validationError = validateSettingValue(
    { valueKind: template.value_kind ?? "text", validMin: metric.valid_min, validMax: metric.valid_max },
    enumCodes,
    value
  );
  if (validationError) throw new Error(`${template.display_name}: ${validationError}`);

  const { data: currentRows } = await supabase
    .from("equipment_configs")
    .select("setting_value, source, ts")
    .eq("equipment_id", device.id)
    .eq("key_name", key)
    .order("ts", { ascending: false })
    .limit(1);
  const previousValue = currentRows?.[0]?.setting_value ?? null;
  // Already what the inverter was last read to have: nothing to send (and no write for the agent to repeat).
  if (previousValue !== null && String(currentRows?.[0]?.source ?? "").startsWith("agent") && sameValue(previousValue, value, template.value_kind ?? "text")) return;

  const { error: insertError } = await supabase.from("equipment_configs").insert({
    equipment_id: device.id,
    setting_category: metric.category,
    key_name: key,
    setting_value: value,
    previous_value: previousValue,
    unit: template.unit,
    source: "customer_dashboard",
    written_by: profile.id,
  });

  if (insertError) throw new Error(insertError.message);

  revalidatePath("/dashboard/devices");
}
