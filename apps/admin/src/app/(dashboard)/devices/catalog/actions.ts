"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { toUserRole } from "../actions";

function toNumberOrNull(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

function toTextOrNull(raw: FormDataEntryValue | null): string | null {
  const str = String(raw ?? "").trim();
  return str || null;
}

const CATALOG_PATH = "/devices/catalog";

function catalogFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    device_category: String(formData.get("deviceCategory") ?? "").trim(),
    unit: toTextOrNull(formData.get("unit")),
    description: toTextOrNull(formData.get("description")),
    value_kind: String(formData.get("valueKind") ?? "numeric"),
    direction: String(formData.get("direction") ?? "read"),
    min_role: toUserRole(formData.get("minRole")),
    regulated: formData.get("regulated") === "on",
    cadence_seconds: toNumberOrNull(formData.get("cadenceSeconds")),
    enum_ref: toTextOrNull(formData.get("enumRef")),
    valid_min: toNumberOrNull(formData.get("validMin")),
    valid_max: toNumberOrNull(formData.get("validMax")),
  };
}

export async function createCatalogEntry(formData: FormData) {
  const instrumentKey = String(formData.get("instrumentKey") ?? "").trim();
  const fields = catalogFields(formData);

  if (!instrumentKey || !fields.name || !fields.category || !fields.device_category) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent("Instrument key, name, category, and device category are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("instrument_catalog").insert({ instrument_key: instrumentKey, ...fields } as never);

  if (error) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(CATALOG_PATH);
  redirect(`${CATALOG_PATH}?success=1`);
}

export async function updateCatalogEntry(instrumentKey: string, formData: FormData) {
  const fields = catalogFields(formData);

  if (!fields.name || !fields.category || !fields.device_category) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent("Name, category, and device category are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("instrument_catalog").update(fields as never).eq("instrument_key", instrumentKey);

  if (error) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(CATALOG_PATH);
  redirect(`${CATALOG_PATH}?success=1`);
}

// device_parameter_map rows reference instrument_catalog by key (fk, no
// cascade) — deleting a key still in use by a model's register mapping
// fails with a real constraint error rather than silently orphaning rows.
export async function deleteCatalogEntry(instrumentKey: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("instrument_catalog").delete().eq("instrument_key", instrumentKey);

  if (error) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(CATALOG_PATH);
  redirect(`${CATALOG_PATH}?success=1`);
}

export async function createEnumValue(formData: FormData) {
  const enumRef = String(formData.get("enumRef") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const notes = toTextOrNull(formData.get("notes"));

  if (!enumRef || !code || !label) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent("Enum ref, code, and label are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("instrument_enum_values").insert({ enum_ref: enumRef, code, label, notes } as never);

  if (error) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(CATALOG_PATH);
  redirect(`${CATALOG_PATH}?success=1`);
}

// Only label/notes are editable — enum_ref+code together are this row's
// primary key, so "renaming" one is really create-a-new-row-and-delete-
// the-old-one, which isn't what an admin fixing a typo in a label wants.
export async function updateEnumValue(enumRef: string, code: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const notes = toTextOrNull(formData.get("notes"));

  if (!label) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent("Label is required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("instrument_enum_values")
    .update({ label, notes })
    .eq("enum_ref", enumRef)
    .eq("code", code);

  if (error) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(CATALOG_PATH);
  redirect(`${CATALOG_PATH}?success=1`);
}

export async function deleteEnumValue(enumRef: string, code: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("instrument_enum_values").delete().eq("enum_ref", enumRef).eq("code", code);

  if (error) {
    redirect(`${CATALOG_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(CATALOG_PATH);
  redirect(`${CATALOG_PATH}?success=1`);
}
