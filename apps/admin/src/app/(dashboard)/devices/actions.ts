"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import type { Database, Json } from "@waytara/supabase";

type UserRole = Database["waytara"]["Enums"]["user_role"];
const USER_ROLES: UserRole[] = ["customer", "employee", "site_engineer", "admin"];
// Exported for devices/catalog/actions.ts's own instrument_catalog forms —
// same enum, same "bad/missing value falls back to customer" reasoning.
export function toUserRole(raw: FormDataEntryValue | null): UserRole {
  const str = String(raw ?? "");
  return (USER_ROLES as string[]).includes(str) ? (str as UserRole) : "customer";
}

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

// device_parameters is retired — this is now the Register Map editor: the
// actual "onboard a new vendor/model" workflow the architecture is built
// around. Two paths depending on whether `parameterKey` already exists in
// instrument_catalog:
//   - Existing key (a second model reusing e.g. "battery_soc_pct"): only
//     the register mapping fields matter — the catalog entry (name,
//     category, value kind, role, ...) is untouched, so onboarding a new
//     vendor is purely additive rows here, never a risk of silently
//     redefining a shared instrument's meaning out from under other models.
//   - New key: also creates the instrument_catalog row from the form's
//     "New instrument" fields, which the client only shows once it detects
//     the typed key doesn't match anything in the datalist it was given.
export async function addParameter(stockId: string, formData: FormData) {
  const parameterKey = String(formData.get("parameterKey") ?? "").trim();
  if (!parameterKey) {
    redirect(`/devices?error=${encodeURIComponent("Instrument key is required.")}`);
  }

  const supabase = await createClient();

  const { data: existingCatalog } = await supabase
    .from("instrument_catalog")
    .select("instrument_key")
    .eq("instrument_key", parameterKey)
    .maybeSingle();

  if (!existingCatalog) {
    const parameterName = String(formData.get("parameterName") ?? "").trim();
    if (!parameterName) {
      redirect(`/devices?error=${encodeURIComponent("Name is required for a new instrument key.")}`);
    }
    const { data: stock } = await supabase.from("stock").select("category").eq("id", stockId).single();
    const { error: catalogError } = await supabase.from("instrument_catalog").insert({
      instrument_key: parameterKey,
      name: parameterName,
      category: String(formData.get("category") ?? "").trim() || "system",
      device_category: stock?.category ?? "solar_inverter",
      unit: String(formData.get("unit") ?? "").trim() || null,
      value_kind: String(formData.get("valueKind") ?? "numeric"),
      direction: String(formData.get("direction") ?? "read"),
      min_role: toUserRole(formData.get("minRole")),
      regulated: formData.get("regulated") === "on",
      cadence_seconds: toNumberOrNull(formData.get("cadenceSeconds")),
    });
    if (catalogError) {
      redirect(`/devices?error=${encodeURIComponent(catalogError.message)}`);
    }
  }

  // Register address — "184" or "72,73" for a multi-register (u32) value.
  // Empty/unparseable input means "no real register" (a manual/
  // informational field, same as before this form gained register support).
  const registersRaw = String(formData.get("registers") ?? "").trim();
  const registers = registersRaw
    ? registersRaw
        .split(",")
        .map((r) => Number(r.trim()))
        .filter((n) => Number.isInteger(n))
    : [];

  const scale = toNumberOrNull(formData.get("scale"));
  const offset = toNumberOrNull(formData.get("offset"));
  const bitmask = toTextOrNull(formData.get("bitmask"));
  const combine = String(formData.get("combine") ?? "") || null;
  const signed = formData.get("signed") === "on";

  const decode: Record<string, Json> = {};
  if (scale !== null) decode.scale = scale;
  if (signed) decode.signed = true;
  if (offset !== null) decode.offset = offset;
  if (bitmask) decode.bitmask = bitmask;
  if (combine) decode.combine = combine;

  const { error: mapError } = await supabase.from("device_parameter_map").insert({
    stock_id: stockId,
    instrument_key: parameterKey,
    protocol: String(formData.get("protocol") ?? "").trim() || "modbus_tcp",
    address: registers.length > 0 ? { registers } : {},
    decode: Object.keys(decode).length > 0 ? decode : null,
    is_required: formData.get("isRequired") === "on",
    verified: formData.get("verified") === "on",
  });

  if (mapError) {
    redirect(`/devices?error=${encodeURIComponent(mapError.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}

export async function removeParameter(parameterMapId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("device_parameter_map").delete().eq("id", parameterMapId);

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}
