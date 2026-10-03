import "server-only";
import type { createClient } from "@waytara/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// The ten variants equipment_templates carries as its own boolean columns
// (7 solar, 3 EV) — the exact set the onboarding wizard asks staff to pick
// from when a new physical device is registered. Kept as one flat list
// (not device_category-nested selects) so the form is a single dropdown,
// matching how the customer's own label workbooks describe these variants.
export const TEMPLATE_VARIANTS = [
  { value: "hybrid_1p_on_grid", label: "Hybrid — 1-Phase — On-Grid", deviceCategory: "solar" as const },
  { value: "hybrid_1p_off_grid", label: "Hybrid — 1-Phase — Off-Grid", deviceCategory: "solar" as const },
  { value: "hybrid_3p_on_grid", label: "Hybrid — 3-Phase — On-Grid", deviceCategory: "solar" as const },
  { value: "hybrid_3p_off_grid", label: "Hybrid — 3-Phase — Off-Grid", deviceCategory: "solar" as const },
  { value: "string_1p_on_grid", label: "String Inverter — 1-Phase — On-Grid", deviceCategory: "solar" as const },
  { value: "string_3p_on_grid", label: "String Inverter — 3-Phase — On-Grid", deviceCategory: "solar" as const },
  { value: "micro_1p_on_grid", label: "Microinverter — 1-Phase — On-Grid", deviceCategory: "solar" as const },
  { value: "ev_slow_ac", label: "EV Charger — Low AC Charging", deviceCategory: "ev" as const },
  { value: "ev_fast_ac", label: "EV Charger — Fast AC Charging", deviceCategory: "ev" as const },
  { value: "ev_dc", label: "EV Charger — DC Charging", deviceCategory: "ev" as const },
] as const;

export type TemplateVariant = (typeof TEMPLATE_VARIANTS)[number]["value"];

export function isTemplateVariant(value: string): value is TemplateVariant {
  return TEMPLATE_VARIANTS.some((v) => v.value === value);
}

/** Clones every equipment_templates row matching the chosen variant into
 *  this device's own equipment_metrics rows — the per-device instantiation
 *  step from the onboarding plan ("select the correct template by type...
 *  and store this under the device"). address/decode start null (staff
 *  fill these in via the register editor, or via "clone from another
 *  device" there); is_verified always starts false, even on a re-run,
 *  since nothing about THIS physical unit's registers has actually been
 *  confirmed yet. show_for_user defaults true — every equipment_templates
 *  row is already customer-appropriate by construction (see its own
 *  seeding). Skips any key_name this device already has mapped, so this
 *  is safe to call more than once (e.g. after fixing a wrong variant pick)
 *  without duplicating or clobbering work already done. */
export async function cloneTemplateIntoEquipment(
  supabase: SupabaseServerClient,
  equipmentId: string,
  variant: TemplateVariant
): Promise<{ error: string | null; inserted: number }> {
  const [{ data: templateRows, error: templateError }, { data: existingRows, error: existingError }] = await Promise.all([
    supabase.from("equipment_templates").select("key_name, category, device_category, direction").eq(variant, true),
    supabase.from("equipment_metrics").select("key_name").eq("equipment_id", equipmentId),
  ]);
  if (templateError) return { error: templateError.message, inserted: 0 };
  if (existingError) return { error: existingError.message, inserted: 0 };

  const already = new Set((existingRows ?? []).map((r) => r.key_name));
  const rows = (templateRows ?? [])
    .filter((t) => !already.has(t.key_name))
    .map((t) => ({
      equipment_id: equipmentId,
      key_name: t.key_name,
      category: t.category,
      device_category: t.device_category,
      direction: t.direction,
      show_for_user: true,
      is_verified: false,
    }));

  if (rows.length === 0) return { error: null, inserted: 0 };

  const { error: insertError } = await supabase.from("equipment_metrics").insert(rows);
  if (insertError) return { error: insertError.message, inserted: 0 };
  return { error: null, inserted: rows.length };
}
