import "server-only";
import { createClient } from "@waytara/supabase/server";
import { quantityLabelOf, type PrefQuantity } from "./unit-prefs";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** One reading a person can choose a unit for: its key, its name on the dashboard, the unit the device reports it in and its kind. */
export interface UnitField {
  key: string;
  label: string;
  unit: string;
  quantity: PrefQuantity;
  /** where it is shown (the dashboard section and group), to tell similar names apart */
  where: string;
}

interface Row {
  key_name: string;
  equipment_templates: { display_name: string; unit: string | null; category: string; group_name: string | null; dashboard_section: string | null } | null;
}

/** The readings of these devices whose unit can be converted (power, energy, temperature, voltage, current), one entry per key, by name. Pure, so
 *  it can be tested without a database. */
export function convertibleFields(rows: readonly Row[]): UnitField[] {
  const seen = new Map<string, UnitField>();
  for (const r of rows) {
    const t = r.equipment_templates;
    const quantity = quantityLabelOf(t?.unit);
    if (!t || !t.unit || !quantity || seen.has(r.key_name)) continue;
    seen.set(r.key_name, { key: r.key_name, label: t.display_name, unit: t.unit, quantity, where: [t.dashboard_section, t.group_name ?? t.category].filter(Boolean).join(" · ") });
  }
  return [...seen.values()].sort((a, b) => a.quantity.localeCompare(b.quantity) || a.label.localeCompare(b.label));
}

/** Every value of the given devices that has a convertible unit (what the "particular values" picker offers). */
export async function fetchUnitFields(supabase: SupabaseServerClient, deviceIds: string[]): Promise<UnitField[]> {
  if (deviceIds.length === 0) return [];
  const { data } = await supabase
    .from("equipment_metrics")
    .select("key_name, equipment_templates!inner(display_name, unit, category, group_name, dashboard_section)")
    .in("equipment_id", deviceIds)
    .eq("direction", "read")
    .eq("show_for_user", true);
  return convertibleFields((data ?? []) as unknown as Row[]);
}
