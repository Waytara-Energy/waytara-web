"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";

function toTextOrNull(raw: FormDataEntryValue | null): string | null {
  const str = String(raw ?? "").trim();
  return str || null;
}

const CATALOG_PATH = "/devices/catalog";

// equipment_enum is the centralized, admin/employee-extensible enum
// library the schema redesign called for — a group (enum_ref) of
// code/label pairs, reusable across any equipment_metrics row (any
// device, any customer) that attaches it via that row's own enum_ref.
// Unlike the old instrument_catalog this page used to also manage,
// there's no separate "definition" table anymore to CRUD alongside it —
// equipment_templates (which enum_ref a field normally uses) is seeded
// from the label workbooks, not hand-edited here.
export async function createEnumValue(formData: FormData): Promise<void> {
  await requireAdmin();
  const enumRef = String(formData.get("enumRef") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const notes = toTextOrNull(formData.get("notes"));

  if (!enumRef || !code || !label) {
    throw new Error("Enum ref, code, and label are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("equipment_enum").insert({ enum_ref: enumRef, code, label, notes } as never);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(CATALOG_PATH);
}

// Only label/notes are editable — enum_ref+code together are this row's
// primary key, so "renaming" one is really create-a-new-row-and-delete-
// the-old-one, which isn't what an admin fixing a typo in a label wants.
export async function updateEnumValue(enumRef: string, code: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const notes = toTextOrNull(formData.get("notes"));

  if (!label) {
    throw new Error("Label is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipment_enum")
    .update({ label, notes })
    .eq("enum_ref", enumRef)
    .eq("code", code);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(CATALOG_PATH);
}

export async function deleteEnumValue(enumRef: string, code: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("equipment_enum").delete().eq("enum_ref", enumRef).eq("code", code);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(CATALOG_PATH);
}
