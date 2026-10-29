"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { copyModelDocuments, discardDocuments, planDocuments } from "@/lib/stock-documents-server";
import { PROTECTED_CATEGORIES, STATUS_OPTIONS, STOCK_COLUMNS, type StockRow } from "./stock-types";

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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** A serial number belongs to one physical unit: say so, with the item that has it, before the database refuses it (the unique index is the last guard). */
async function assertSerialFree(supabase: Supabase, serial: unknown, exceptId?: string): Promise<void> {
  if (typeof serial !== "string" || !serial.trim()) return;
  let query = supabase
    .from("equipment_inventory")
    .select("id, name")
    .ilike("serial_number", serial.trim().replace(/[\\%_]/g, "\\$&"))
    .limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query;
  if (data && data.length > 0) {
    throw new Error(`The serial number ${serial.trim()} is already used by “${data[0]!.name}”. Each unit needs its own.`);
  }
}

function friendlyDbError(error: { message: string; code?: string }): Error {
  if (error.code === "23505") return new Error("That serial number is already used by another stock item.");
  return new Error(error.message);
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
      phase_count: toNumberOrNull(formData.get("phaseCount")),
    },
  };
}

export async function createStockItem(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = readStockFields(formData);
  if (!result.ok) {
    throw new Error(result.error);
  }
  const { fields } = result;

  if (!fields.name || !fields.category) {
    throw new Error("Name and category are required.");
  }

  const supabase = await createClient();
  await assertSerialFree(supabase, fields.serial_number);
  // the files the browser uploaded (purchase order, manual, data sheet) are checked first, and taken down again if the item can't be saved
  const docs = await planDocuments(supabase, formData, null);
  const { data, error } = await supabase.from("equipment_inventory").insert({ ...fields, ...docs.columns } as never).select("id").single();

  if (error || !data) {
    await discardDocuments(supabase, docs.added);
    throw error ? friendlyDbError(error) : new Error("Couldn't add the stock item.");
  }

  revalidatePath("/devices");
  // on success the person lands on the new item's own page
  redirect(`/devices/stock/${data.id}`);
}

export async function updateStockItem(stockId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const result = readStockFields(formData);
  if (!result.ok) {
    throw new Error(result.error);
  }
  const { fields } = result;

  if (!fields.name || !fields.category) {
    throw new Error("Name and category are required.");
  }

  const supabase = await createClient();
  await assertSerialFree(supabase, fields.serial_number, stockId);

  // each file: a new upload replaces the old one; "remove" clears it; otherwise it stays as it is
  const { data: current } = await supabase.from("equipment_inventory").select(STOCK_COLUMNS).eq("id", stockId).maybeSingle();
  const docs = await planDocuments(supabase, formData, current);

  const { error } = await supabase.from("equipment_inventory").update({ ...fields, ...docs.columns } as never).eq("id", stockId);

  if (error) {
    await discardDocuments(supabase, docs.added);
    throw friendlyDbError(error);
  }
  // the old files are only taken down once the new state is saved
  await discardDocuments(supabase, docs.replaced);

  revalidatePath("/devices");
  revalidatePath(`/devices/stock/${stockId}`);
}

/**
 * A copy of an existing item: everything that describes the MODEL (category, make and model, power, size, unit, unit price, technical details,
 * warranty) is taken from the original here on the server, and the admin gives only what is unique to the copy: its serial number, how many, its
 * status, and the purchase (date, PO, price, supplier). An original with a serial number needs the copy to have its own.
 */
export async function duplicateStockItem(sourceId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase.from("equipment_inventory").select(STOCK_COLUMNS).eq("id", sourceId).maybeSingle();
  if (!data) throw new Error("The item to copy was not found. It may have been deleted.");
  const src = data as unknown as StockRow;

  const name = String(formData.get("name") ?? "").trim() || src.name;
  const serial = toTextOrNull(formData.get("serialNumber"));
  if (src.serial_number && !serial) throw new Error("Give the copy its own serial number.");

  const quantity = toNumberOrNull(formData.get("quantity"));
  if (quantity === null || quantity < 0) throw new Error("Enter how many the copy has (0 or more).");

  const status = String(formData.get("status") ?? "in_stock");
  if (!(STATUS_OPTIONS as readonly string[]).includes(status)) throw new Error("Choose a status for the copy.");

  await assertSerialFree(supabase, serial);

  const fields = {
    // taken from the original
    category: src.category,
    brand: src.brand,
    model: src.model,
    model_number: src.model_number,
    manufacturer: src.manufacturer,
    power_capacity_value: src.power_capacity_value,
    power_capacity_unit: src.power_capacity_unit,
    size_value: src.size_value,
    size_unit: src.size_unit,
    technical_specs: src.technical_specs,
    warranty_info: src.warranty_info,
    pack_size: src.pack_size,
    primary_uom: src.primary_uom,
    unit_price: src.unit_price,
    phase_count: src.phase_count,
    // the copy's own
    name,
    serial_number: serial,
    quantity,
    status,
    purchase_date: toTextOrNull(formData.get("purchaseDate")),
    po_reference: toTextOrNull(formData.get("poReference")),
    purchase_price_amount: toNumberOrNull(formData.get("purchasePriceAmount")),
    supplier: toTextOrNull(formData.get("supplier")),
  };

  // the copy gets its own purchase order (uploaded by the browser), and its own copies of the model's manual and data sheet
  const docs = await planDocuments(supabase, formData, null);
  let model: Awaited<ReturnType<typeof copyModelDocuments>>;
  try {
    model = await copyModelDocuments(supabase, src);
  } catch (e) {
    await discardDocuments(supabase, docs.added);
    throw e;
  }
  const { data: created, error } = await supabase.from("equipment_inventory").insert({ ...fields, ...model.columns, ...docs.columns } as never).select("id").single();
  if (error || !created) {
    await discardDocuments(supabase, [...docs.added, ...model.added]);
    throw error ? friendlyDbError(error) : new Error("Couldn't copy the stock item.");
  }

  revalidatePath("/devices");
  redirect(`/devices/stock/${created.id}`);
}

export type CategoryResult = { ok: true; name: string } | { ok: false; error: string };

/** Adds a category to the list (or returns the one that is already there under the same name, whatever its capitals). */
export async function addStockCategory(rawName: string): Promise<CategoryResult> {
  await requireAdmin();
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Type a name for the category." };
  if (name.length > 60) return { ok: false, error: "A category name can be 60 letters at most." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("stock_categories").select("name");
  const same = (existing ?? []).find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (same) return { ok: true, name: same.name };

  const { error } = await supabase.from("stock_categories").insert({ name });
  if (error) return { ok: false, error: error.message };
  return { ok: true, name };
}

/** Removes a category that no stock item is in. The two the system depends on, and any with items, stay. */
export async function removeStockCategory(name: string): Promise<CategoryResult> {
  await requireAdmin();
  if (PROTECTED_CATEGORIES.includes(name)) return { ok: false, error: "The system uses this category, so it can't be removed." };

  const supabase = await createClient();
  const { count } = await supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("category", name);
  if (count) return { ok: false, error: `${count} stock ${count === 1 ? "item is" : "items are"} in this category. Move ${count === 1 ? "it" : "them"} to another category first.` };

  const { error } = await supabase.from("stock_categories").delete().eq("name", name);
  if (error) return { ok: false, error: error.message };
  return { ok: true, name };
}
