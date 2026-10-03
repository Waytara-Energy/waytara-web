"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import type { Json } from "@waytara/supabase";

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

function registersPath(equipmentId: string): string {
  return `/devices/${equipmentId}/registers`;
}

// One row's address/decode/limits/enum/flags — the actual "fill in what
// the register is" step, on the row equipment creation already cloned in
// from equipment_templates (see equipment-templates.ts). Registers —
// "184" or "72,73" for a multi-register (u32) value — parsed the same way
// the old stock-scoped editor did; empty/unparseable means "no real
// register" (a manual/informational field).
export async function updateEquipmentMetric(equipmentId: string, metricId: string, formData: FormData): Promise<void> {
  await requireAdmin();
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
  const combine = toTextOrNull(formData.get("combine"));
  const signed = formData.get("signed") === "on";
  const lowWordRegister = toNumberOrNull(formData.get("lowWordRegister"));

  const decode: Record<string, Json> = {};
  if (scale !== null) decode.scale = scale;
  if (signed) decode.signed = true;
  if (offset !== null) decode.offset = offset;
  if (bitmask) decode.bitmask = bitmask;
  if (combine) decode.combine = combine;
  if (combine === "low_high_word" && lowWordRegister !== null) decode.low_word_register = lowWordRegister;

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipment_metrics")
    .update({
      address: registers.length > 0 ? { registers } : null,
      decode: Object.keys(decode).length > 0 ? decode : null,
      enum_ref: toTextOrNull(formData.get("enumRef")),
      valid_min: toNumberOrNull(formData.get("validMin")),
      valid_max: toNumberOrNull(formData.get("validMax")),
      cadence_seconds: toNumberOrNull(formData.get("cadenceSeconds")),
      show_for_user: formData.get("showForUser") === "on",
      is_verified: formData.get("isVerified") === "on",
      notes: toTextOrNull(formData.get("notes")),
    })
    .eq("id", metricId)
    .eq("equipment_id", equipmentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(registersPath(equipmentId));
}

// "Clone register addresses from…" — every equipment_metrics row this
// device has was already created (empty address/decode) by the variant
// template clone at onboarding time, so cloning here only ever fills in
// existing rows by matching key_name, never inserts new ones. Skips a
// key_name the source device doesn't have mapped, and never touches a
// key_name already carrying an address on the target — this is meant for
// filling gaps on a fresh device from a known-good twin, not overwriting
// deltas someone already entered.
export async function cloneRegistersFromDevice(equipmentId: string, formData: FormData): Promise<string> {
  await requireAdmin();
  const fromEquipmentId = String(formData.get("fromEquipmentId") ?? "").trim();
  if (!fromEquipmentId) {
    throw new Error("Pick a source device to clone from.");
  }
  if (fromEquipmentId === equipmentId) {
    throw new Error("Can't clone a device's registers from itself.");
  }

  const supabase = await createClient();

  const [{ data: sourceRows, error: sourceError }, { data: targetRows, error: targetError }] = await Promise.all([
    supabase
      .from("equipment_metrics")
      .select("key_name, address, decode, enum_ref, valid_min, valid_max, cadence_seconds")
      .eq("equipment_id", fromEquipmentId)
      .not("address", "is", null),
    supabase.from("equipment_metrics").select("id, key_name, address").eq("equipment_id", equipmentId),
  ]);
  if (sourceError) throw new Error(sourceError.message);
  if (targetError) throw new Error(targetError.message);

  const targetByKey = new Map((targetRows ?? []).map((r) => [r.key_name, r]));
  const updates = (sourceRows ?? [])
    .map((s) => ({ source: s, target: targetByKey.get(s.key_name) }))
    .filter((pair) => pair.target && pair.target.address === null);

  if (updates.length === 0) {
    throw new Error("Nothing to clone — no matching gaps found.");
  }

  // One UPDATE per row (each needs its own values, not a uniform SET) —
  // no id shared across rows to batch through a single `.in()` call.
  const results = await Promise.all(
    updates.map(({ source, target }) =>
      supabase
        .from("equipment_metrics")
        .update({
          address: source.address,
          decode: source.decode,
          enum_ref: source.enum_ref,
          valid_min: source.valid_min,
          valid_max: source.valid_max,
          cadence_seconds: source.cadence_seconds,
          is_verified: false,
        })
        .eq("id", target!.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw new Error(failed.error.message);
  }

  revalidatePath(registersPath(equipmentId));
  return `Cloned ${updates.length} register address(es) — verify and edit as needed.`;
}

// Bulk register-table paste — one line per key, so correcting or filling
// in dozens of rows at once doesn't mean dozens of individual per-row
// form submissions. Only updates rows this device already has (from its
// template clone) — a key_name that doesn't match anything here is
// reported back, never inserted as a new row (equipment_metrics rows are
// only ever created by cloning a template variant, not defined ad hoc).
// Line format: key_name|registers|scale|offset|signed|bitmask|combine
export async function bulkUpdateRegisters(equipmentId: string, formData: FormData): Promise<string> {
  await requireAdmin();
  const raw = String(formData.get("rows") ?? "");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Paste at least one register row.");
  }

  const supabase = await createClient();
  const { data: existingRows } = await supabase.from("equipment_metrics").select("id, key_name").eq("equipment_id", equipmentId);
  const byKey = new Map((existingRows ?? []).map((r) => [r.key_name, r.id]));

  const skipped: string[] = [];
  const updates: { id: string; address: Json; decode: Json | null }[] = [];

  for (const line of lines) {
    const [keyRaw, registersRaw, scaleRaw, offsetRaw, signedRaw, bitmaskRaw, combineRaw] = line.split("|").map((f) => f?.trim() ?? "");
    const key = keyRaw ?? "";
    const metricId = byKey.get(key);

    if (!key) {
      skipped.push("(blank line) — missing key_name");
      continue;
    }
    if (!metricId) {
      skipped.push(`${key} — not mapped on this device (pick a template variant that includes it first)`);
      continue;
    }

    const registers = (registersRaw ?? "")
      .split(",")
      .map((r) => Number(r.trim()))
      .filter((n) => Number.isInteger(n));
    if (registers.length === 0) {
      skipped.push(`${key} — no valid register address`);
      continue;
    }

    const scale = toNumberOrNull(scaleRaw);
    const offset = toNumberOrNull(offsetRaw);
    const bitmask = toTextOrNull(bitmaskRaw);
    const combine = toTextOrNull(combineRaw);
    const signed = (signedRaw ?? "").toLowerCase() === "true" || signedRaw === "1";

    const decode: Record<string, Json> = {};
    if (scale !== null) decode.scale = scale;
    if (signed) decode.signed = true;
    if (offset !== null) decode.offset = offset;
    if (bitmask) decode.bitmask = bitmask;
    if (combine) decode.combine = combine;

    updates.push({
      id: metricId,
      address: { registers },
      decode: Object.keys(decode).length > 0 ? decode : null,
    });
  }

  if (updates.length > 0) {
    const results = await Promise.all(
      updates.map((u) => supabase.from("equipment_metrics").update({ address: u.address, decode: u.decode, is_verified: false }).eq("id", u.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      throw new Error(failed.error.message);
    }
  }

  revalidatePath(registersPath(equipmentId));
  const summary = `Updated ${updates.length} register(s).` + (skipped.length > 0 ? ` Skipped ${skipped.length}: ${skipped.join("; ")}` : "");
  if (updates.length === 0) {
    throw new Error(summary);
  }
  return summary;
}
