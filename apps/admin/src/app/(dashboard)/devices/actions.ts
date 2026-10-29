"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { checkUploaded, discardDocuments, planDocuments } from "@/lib/stock-documents-server";
import { MANUAL_STATUSES, PROTECTED_CATEGORIES } from "./stock-types";

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

// technical_specs / warranty_info are free-form jsonb — the form builds them from friendly name/value rows and sends JSON text. Invalid JSON
// fails the save with a clear error rather than silently storing a string.
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

type ReadModelResult = { ok: true; fields: Record<string, unknown> } | { ok: false; error: string };

/** The model's own fields (what the product is). Stock (serial numbers, quantities, purchases) is never part of this: it is received. */
function readModelFields(formData: FormData): ReadModelResult {
  const technicalSpecs = toJsonOrNull(formData.get("technicalSpecs"));
  if (technicalSpecs.error) return { ok: false, error: `Technical specs ${technicalSpecs.error}.` };
  const warrantyInfo = toJsonOrNull(formData.get("warrantyInfo"));
  if (warrantyInfo.error) return { ok: false, error: `Warranty info ${warrantyInfo.error}.` };
  const tracking = String(formData.get("tracking") ?? "serial");
  if (tracking !== "serial" && tracking !== "lot") return { ok: false, error: "Choose how this model's stock is counted." };

  return {
    ok: true,
    fields: {
      name: String(formData.get("name") ?? "").trim(),
      category: String(formData.get("category") ?? "").trim(),
      brand: toTextOrNull(formData.get("brand")),
      model: toTextOrNull(formData.get("model")),
      model_number: toTextOrNull(formData.get("modelNumber")),
      manufacturer: toTextOrNull(formData.get("manufacturer")),
      tracking,
      reorder_level: Math.max(0, Math.floor(toNumberOrNull(formData.get("reorderLevel")) ?? 0)),
      power_capacity_value: toNumberOrNull(formData.get("powerCapacityValue")),
      power_capacity_unit: toTextOrNull(formData.get("powerCapacityUnit")),
      size_value: toNumberOrNull(formData.get("sizeValue")),
      size_unit: toTextOrNull(formData.get("sizeUnit")),
      technical_specs: technicalSpecs.value,
      warranty_info: warrantyInfo.value,
      pack_size: toNumberOrNull(formData.get("packSize")),
      primary_uom: toTextOrNull(formData.get("primaryUom")),
      unit_price: toNumberOrNull(formData.get("unitPrice")),
      phase_count: toNumberOrNull(formData.get("phaseCount")),
    },
  };
}

/** The manual and the data sheet belong to the model (the purchase order belongs to a delivery, see receiveStock). */
const MODEL_DOCUMENTS = ["manual", "datasheet"] as const;

export async function createStockItem(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = readModelFields(formData);
  if (!result.ok) throw new Error(result.error);
  const { fields } = result;
  if (!fields.name || !fields.category) throw new Error("Name and category are required.");

  const supabase = await createClient();
  // the files the browser uploaded are checked first, and taken down again if the model can't be saved
  const docs = await planDocuments(supabase, formData, null, MODEL_DOCUMENTS);
  const { data, error } = await supabase.from("equipment_inventory").insert({ ...fields, ...docs.columns } as never).select("id").single();
  if (error || !data) {
    await discardDocuments(supabase, docs.added);
    throw new Error(error?.message ?? "Couldn't add the model.");
  }

  revalidatePath("/devices");
  // on success the person lands on the new model's own page, ready to receive its first stock
  redirect(`/devices/stock/${data.id}`);
}

export async function updateStockItem(stockId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const result = readModelFields(formData);
  if (!result.ok) throw new Error(result.error);
  const { fields } = result;
  if (!fields.name || !fields.category) throw new Error("Name and category are required.");

  const supabase = await createClient();
  // how the stock is counted cannot change once there is stock (a serial number and a lot are different things)
  const { data: current } = await supabase.from("equipment_inventory").select("tracking, manual_document_path, datasheet_document_path, manual_document_name, datasheet_document_name, manual_document_type, datasheet_document_type, manual_document_size, datasheet_document_size").eq("id", stockId).maybeSingle();
  if (!current) throw new Error("This model was not found. It may have been deleted.");
  if (current.tracking !== fields.tracking) {
    const { count } = await supabase.from("stock_units").select("id", { count: "exact", head: true }).eq("model_id", stockId);
    if (count) throw new Error("This model already has stock, so how it is counted can't change.");
  }

  const docs = await planDocuments(supabase, formData, current, MODEL_DOCUMENTS);
  const { error } = await supabase.from("equipment_inventory").update({ ...fields, ...docs.columns } as never).eq("id", stockId);
  if (error) {
    await discardDocuments(supabase, docs.added);
    throw new Error(error.message);
  }
  // the old files are only taken down once the new state is saved
  await discardDocuments(supabase, docs.replaced);

  revalidatePath("/devices");
  revalidatePath(`/devices/stock/${stockId}`);
}

// ---- Receiving stock -------------------------------------------------------------------------------------------------------------------------

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Serial numbers pasted or typed: one per line, or separated by commas, semicolons or tabs. */
function splitSerials(raw: string): string[] {
  return raw.split(/[\n\r,;\t]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * A delivery arrives: the units (one per serial number) or the lot (a quantity and a lot id), with the supplier, the purchase order and its file, the
 * date and the cost. Done in one database step, so a failed delivery leaves nothing half-recorded. Returns the model to go to.
 */
export async function receiveStock(formData: FormData): Promise<ActionResult & { modelId?: string }> {
  await requireAdmin();
  const modelId = String(formData.get("modelId") ?? "");
  if (!modelId) return { ok: false, error: "Choose which model arrived." };

  const supabase = await createClient();
  const { data: model } = await supabase.from("equipment_inventory").select("id, tracking").eq("id", modelId).maybeSingle();
  if (!model) return { ok: false, error: "That model was not found." };

  const serial = model.tracking === "serial";
  const serials = serial ? splitSerials(String(formData.get("serials") ?? "")) : [String(formData.get("lotId") ?? "").trim()].filter(Boolean);
  const quantity = serial ? serials.length : Math.floor(toNumberOrNull(formData.get("quantity")) ?? 0);
  if (serial && serials.length === 0) return { ok: false, error: "Enter at least one serial number." };
  if (!serial && quantity < 1) return { ok: false, error: "Enter how many arrived." };

  // the purchase order file the browser uploaded, checked against the bucket
  let po: { path: string; name: string; type: string; size: number } | null = null;
  const poPath = String(formData.get("poPath") ?? "").trim();
  const poName = String(formData.get("poName") ?? "").trim();
  if (poPath && poName) {
    try {
      const stored = await checkUploaded(supabase, "po", poPath, poName);
      po = { path: stored.path, name: stored.name, type: stored.type, size: stored.size };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "The purchase order file couldn't be checked." };
    }
  }

  const { error } = await supabase.rpc("receive_stock", {
    p_model: modelId,
    p_serials: serials,
    p_quantity: quantity,
    p_supplier: toTextOrNull(formData.get("supplier")),
    p_po_reference: toTextOrNull(formData.get("poReference")),
    p_received_on: toTextOrNull(formData.get("receivedOn")),
    p_unit_cost: toNumberOrNull(formData.get("unitCost")),
    p_location: toTextOrNull(formData.get("location")),
    p_notes: toTextOrNull(formData.get("notes")),
    p_po: po,
    // the database function treats an empty value as "not given"; its generated argument types don't allow null
  } as never);
  if (error) {
    if (po) await discardDocuments(supabase, [{ slot: "po", path: po.path }]);
    return { ok: false, error: error.message };
  }

  revalidatePath("/devices");
  revalidatePath(`/devices/stock/${modelId}`);
  return { ok: true, modelId, message: serial ? `${quantity} ${quantity === 1 ? "unit" : "units"} added to stock.` : `${quantity} added to stock.` };
}

// ---- Units: reserve, release, change status, remove -----------------------------------------------------------------------------------------

async function afterUnitChange(supabase: Supabase, unitId: string) {
  const { data } = await supabase.from("stock_units").select("model_id").eq("id", unitId).maybeSingle();
  revalidatePath("/devices");
  if (data) revalidatePath(`/devices/stock/${data.model_id}`);
}

/** Holds a unit for a customer (and one of their sites), so it can't be given to anyone else. */
export async function reserveUnit(unitId: string, customerId: string, siteId: string | null): Promise<ActionResult> {
  await requireAdmin();
  if (!customerId) return { ok: false, error: "Choose the customer." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reserve_unit", { p_unit: unitId, p_customer: customerId, p_site: siteId ?? undefined });
  if (error) return { ok: false, error: error.message };
  await afterUnitChange(supabase, unitId);
  return { ok: true, message: "Reserved." };
}

export async function releaseUnit(unitId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_unit", { p_unit: unitId });
  if (error) return { ok: false, error: error.message };
  await afterUnitChange(supabase, unitId);
  return { ok: true, message: "Released back to stock." };
}

export async function setUnitStatus(unitId: string, status: string, note: string | null): Promise<ActionResult> {
  await requireAdmin();
  if (!(MANUAL_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Choose a status." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_unit_status", { p_unit: unitId, p_status: status, p_note: note?.trim() || undefined });
  if (error) return { ok: false, error: error.message };
  await afterUnitChange(supabase, unitId);
  return { ok: true, message: "Status updated." };
}

/** Takes a unit that was entered by mistake off the books. Only a unit that was never reserved or installed can go; the history keeps a note of it. */
export async function deleteUnit(unitId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: unit } = await supabase.from("stock_units").select("id, model_id, serial_number, status, quantity, remaining").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "That unit was not found." };
  if (unit.status !== "in_stock" || unit.remaining !== unit.quantity) return { ok: false, error: "Only a unit that is still in stock and untouched can be removed. Retire it instead." };

  const { count } = await supabase.from("equipment").select("id", { count: "exact", head: true }).eq("stock_unit_id", unitId);
  if (count) return { ok: false, error: "A device at a customer uses this unit." };

  await supabase.from("stock_movements").insert({ model_id: unit.model_id, unit_id: null, kind: "removed", quantity: unit.quantity, from_status: "in_stock", note: `Entered by mistake: ${unit.serial_number}` });
  const { error } = await supabase.from("stock_units").delete().eq("id", unitId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/devices");
  revalidatePath(`/devices/stock/${unit.model_id}`);
  return { ok: true, message: "Removed." };
}

// ---- Categories -----------------------------------------------------------------------------------------------------------------------------

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
  if (count) return { ok: false, error: `${count} ${count === 1 ? "model is" : "models are"} in this category. Move ${count === 1 ? "it" : "them"} to another category first.` };

  const { error } = await supabase.from("stock_categories").delete().eq("name", name);
  if (error) return { ok: false, error: error.message };
  return { ok: true, name };
}
