"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";

// Numeric/date form fields all follow the same "empty string -> null,
// otherwise parse" rule — <input type="number"> and <input type="date">
// both submit "" when left blank, which Number("") coerces to 0 (wrong)
// rather than null (right).
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

// technical_specs / warranty_info are free-form jsonb — the form just
// takes raw JSON text so the catalog isn't limited to a fixed set of spec
// fields (a wire's spec sheet looks nothing like an inverter's). Invalid
// JSON fails the save with a clear error rather than silently storing a
// string.
function toJsonOrNull(raw: FormDataEntryValue | null): { value: unknown; error?: string } {
  const str = String(raw ?? "").trim();
  if (!str) return { value: null };
  try {
    return { value: JSON.parse(str) };
  } catch {
    return { value: null, error: "must be valid JSON" };
  }
}

type ReadStockFieldsResult = { ok: true; fields: Record<string, unknown> } | { ok: false; error: string };

function readStockFields(formData: FormData): ReadStockFieldsResult {
  const technicalSpecs = toJsonOrNull(formData.get("technicalSpecs"));
  if (technicalSpecs.error) return { ok: false, error: `Technical specs ${technicalSpecs.error}.` };
  const warrantyInfo = toJsonOrNull(formData.get("warrantyInfo"));
  if (warrantyInfo.error) return { ok: false, error: `Warranty info ${warrantyInfo.error}.` };

  return {
    ok: true,
    fields: {
      name: String(formData.get("name") ?? "").trim(),
      category: String(formData.get("category") ?? "").trim(),
      brand: toTextOrNull(formData.get("brand")),
      model: toTextOrNull(formData.get("model")),
      model_number: toTextOrNull(formData.get("modelNumber")),
      manufacturer: toTextOrNull(formData.get("manufacturer")),
      serial_number: toTextOrNull(formData.get("serialNumber")),
      status: toTextOrNull(formData.get("status")) ?? "active",
      power_capacity_value: toNumberOrNull(formData.get("powerCapacityValue")),
      power_capacity_unit: toTextOrNull(formData.get("powerCapacityUnit")),
      size_value: toNumberOrNull(formData.get("sizeValue")),
      size_unit: toTextOrNull(formData.get("sizeUnit")),
      technical_specs: technicalSpecs.value,
      warranty_info: warrantyInfo.value,
      quantity: toNumberOrNull(formData.get("quantity")) ?? 0,
      pack_size: toNumberOrNull(formData.get("packSize")),
      primary_uom: toTextOrNull(formData.get("primaryUom")),
      purchase_price_amount: toNumberOrNull(formData.get("purchasePriceAmount")),
      unit_price: toNumberOrNull(formData.get("unitPrice")),
      purchase_date: toTextOrNull(formData.get("purchaseDate")),
      supplier: toTextOrNull(formData.get("supplier")),
      po_reference: toTextOrNull(formData.get("poReference")),
    },
  };
}

export async function createStockItem(formData: FormData) {
  const result = readStockFields(formData);
  if (!result.ok) {
    redirect(`/devices?error=${encodeURIComponent(result.error)}`);
  }
  const { fields } = result;

  if (!fields.name || !fields.category) {
    redirect(`/devices?error=${encodeURIComponent("Name and category are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock").insert(fields as never);

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}

export async function updateStockItem(stockId: string, formData: FormData) {
  const result = readStockFields(formData);
  if (!result.ok) {
    redirect(`/devices?error=${encodeURIComponent(result.error)}`);
  }
  const { fields } = result;

  if (!fields.name || !fields.category) {
    redirect(`/devices?error=${encodeURIComponent("Name and category are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock").update(fields as never).eq("id", stockId);

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}

export async function addParameter(stockId: string, formData: FormData) {
  const parameterKey = String(formData.get("parameterKey") ?? "").trim();
  const parameterName = String(formData.get("parameterName") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const isRequired = formData.get("isRequired") === "on";

  if (!parameterKey || !parameterName) {
    redirect(`/devices?error=${encodeURIComponent("Parameter key and name are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("device_parameters").insert({
    device_type_id: stockId,
    parameter_key: parameterKey,
    parameter_name: parameterName,
    unit,
    category,
    is_required: isRequired,
  });

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}

export async function removeParameter(parameterId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("device_parameters").delete().eq("id", parameterId);

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}
