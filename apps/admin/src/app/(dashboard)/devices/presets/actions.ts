"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import type { Json } from "@waytara/supabase";

const PRESETS_PATH = "/devices/presets";

function parseValuesJson(raw: FormDataEntryValue | null): { value: Record<string, Json>; error?: string } {
  const str = String(raw ?? "").trim();
  if (!str) return { value: {}, error: "Values can't be empty — a preset with nothing to apply isn't useful." };
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { value: {}, error: "Values must be a JSON object of {instrument_key: value}." };
    }
    return { value: parsed };
  } catch {
    return { value: {}, error: "Values must be valid JSON." };
  }
}

export async function createPreset(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const deviceCategory = String(formData.get("deviceCategory") ?? "").trim();
  const isActive = formData.get("isActive") === "on";
  const values = parseValuesJson(formData.get("values"));

  if (!key || !name || !description || !deviceCategory) {
    redirect(`${PRESETS_PATH}?error=${encodeURIComponent("Key, name, description, and device category are required.")}`);
  }
  if (values.error) {
    redirect(`${PRESETS_PATH}?error=${encodeURIComponent(values.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("setting_presets").insert({
    key,
    name,
    description,
    device_category: deviceCategory,
    values: values.value,
    is_active: isActive,
  });

  if (error) {
    redirect(`${PRESETS_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(PRESETS_PATH);
  redirect(`${PRESETS_PATH}?success=1`);
}

export async function updatePreset(key: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const deviceCategory = String(formData.get("deviceCategory") ?? "").trim();
  const isActive = formData.get("isActive") === "on";
  const values = parseValuesJson(formData.get("values"));

  if (!name || !description || !deviceCategory) {
    redirect(`${PRESETS_PATH}?error=${encodeURIComponent("Name, description, and device category are required.")}`);
  }
  if (values.error) {
    redirect(`${PRESETS_PATH}?error=${encodeURIComponent(values.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("setting_presets")
    .update({ name, description, device_category: deviceCategory, values: values.value, is_active: isActive })
    .eq("key", key);

  if (error) {
    redirect(`${PRESETS_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(PRESETS_PATH);
  redirect(`${PRESETS_PATH}?success=1`);
}

// device_settings.applied_preset_key references this table by key with no
// cascade — deleting a preset that's ever been applied to a real device
// fails loudly instead of orphaning that history, same reasoning as
// devices/catalog/actions.ts's deleteCatalogEntry.
export async function deletePreset(key: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("setting_presets").delete().eq("key", key);

  if (error) {
    redirect(`${PRESETS_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(PRESETS_PATH);
  redirect(`${PRESETS_PATH}?success=1`);
}

export interface PresetPreviewRow {
  key: string;
  catalogName: string | null;
  unit: string | null;
  currentValue: string | null;
  presetValue: string;
}

// Read-only: shows what applying `presetKey` to `deviceId` would actually
// write, side-by-side with what's there now — the admin never applies it
// from here (that stays a customer-initiated action on the web app), this
// is purely "does this preset do what I think it does" before publishing
// it as is_active.
export async function previewPresetForDevice(deviceId: string, presetKey: string): Promise<{ error: string } | { rows: PresetPreviewRow[] }> {
  const supabase = await createClient();

  const { data: preset } = await supabase.from("setting_presets").select("values").eq("key", presetKey).maybeSingle();
  if (!preset) return { error: "Preset not found." };

  const values = preset.values as Record<string, string | number | boolean>;
  const keys = Object.keys(values);
  if (keys.length === 0) return { rows: [] };

  const [{ data: catalogRows }, { data: currentRows }] = await Promise.all([
    supabase.from("instrument_catalog").select("instrument_key, name, unit").in("instrument_key", keys),
    supabase
      .from("device_settings")
      .select("setting_key, setting_value, ts")
      .eq("device_id", deviceId)
      .in("setting_key", keys)
      .order("ts", { ascending: true }),
  ]);

  const catalogByKey = new Map((catalogRows ?? []).map((c) => [c.instrument_key, c]));
  const currentByKey = new Map<string, string>();
  for (const row of currentRows ?? []) currentByKey.set(row.setting_key, row.setting_value);

  const rows: PresetPreviewRow[] = keys.map((key) => ({
    key,
    catalogName: catalogByKey.get(key)?.name ?? null,
    unit: catalogByKey.get(key)?.unit ?? null,
    currentValue: currentByKey.get(key) ?? null,
    presetValue: String(values[key]),
  }));

  return { rows };
}
