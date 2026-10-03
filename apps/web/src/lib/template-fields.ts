import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "./selected-site";
import { co2AvoidedKg, treesEquivalent } from "./environmental-impact";
import type { TemplateField, FieldValue } from "./template-field-format";

export type { TemplateField, FieldValue } from "./template-field-format";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The read-side counterpart to instrument-catalog-data.ts's write-side
 *  fetchDeviceSettingFields — the single source every dashboard page reads
 *  its field list from now, replacing the old hardcoded
 *  telemetry-catalog.ts/ev-charger-catalog.ts constants entirely. A field
 *  only ever appears here because this specific device's own
 *  equipment_metrics says it does (show_for_user = true) — there's no
 *  separate "does this device type support this" list to keep in sync. */
export interface FieldGroup {
  groupName: string | null;
  fields: TemplateField[];
}

export interface CategorySection {
  category: string;
  groups: FieldGroup[];
}

/** Every read-direction field this device has mapped for one dashboard
 *  section (Overview/Monitoring/Performance/Maintenance/Reports/Device &
 *  Settings), grouped exactly as the source workbook grouped it
 *  (category -> group_name) — joins this device's own equipment_metrics
 *  rows to equipment_templates for display metadata. Groups/categories are
 *  returned in the order the DB naturally sorts them (category, then
 *  group_name, then key_name) — callers needing a specific display order
 *  reorder client-side. */
export async function fetchDashboardFields(
  supabase: SupabaseServerClient,
  device: CustomerDevice,
  dashboardSection: string
): Promise<CategorySection[]> {
  const { data: rows } = await supabase
    .from("equipment_metrics")
    .select(
      "key_name, enum_ref, equipment_templates!inner(display_name, unit, value_kind, category, group_name, dashboard_section, source)"
    )
    .eq("equipment_id", device.id)
    .eq("direction", "read")
    .eq("show_for_user", true)
    .eq("equipment_templates.dashboard_section", dashboardSection)
    .order("category", { referencedTable: "equipment_templates" })
    .order("group_name", { referencedTable: "equipment_templates" })
    .order("key_name", { referencedTable: "equipment_templates" });

  const sections = new Map<string, Map<string | null, TemplateField[]>>();
  for (const row of rows ?? []) {
    const t = row.equipment_templates;
    const field: TemplateField = {
      key: row.key_name,
      label: t.display_name,
      unit: t.unit,
      valueKind: t.value_kind ?? "text",
      enumRef: row.enum_ref,
      source: t.source,
    };
    const groupsByName = sections.get(t.category) ?? new Map<string | null, TemplateField[]>();
    const list = groupsByName.get(t.group_name) ?? [];
    list.push(field);
    groupsByName.set(t.group_name, list);
    sections.set(t.category, groupsByName);
  }

  return Array.from(sections.entries()).map(([category, groupsByName]) => ({
    category,
    groups: Array.from(groupsByName.entries()).map(([groupName, fields]) => ({ groupName, fields })),
  }));
}

/** Latest equipment_telemetry value per key — only ever populated for
 *  source: "inverter" fields with a real register/OCPP path; source:
 *  "calculated"/"platform"/"weather" fields resolve through
 *  resolveComputedValue instead (see below), and a text/timestamp-kind
 *  field with no live storage path yet simply has no row (renders as "no
 *  data", not a lie about a value that was never actually read). */
export async function fetchFieldValues(
  supabase: SupabaseServerClient,
  deviceId: string,
  keys: string[]
): Promise<Map<string, FieldValue>> {
  const values = new Map<string, FieldValue>();
  if (keys.length === 0) return values;

  const { data: rows } = await supabase
    .from("equipment_telemetry")
    .select("key_name, value, ts")
    .eq("equipment_id", deviceId)
    .in("key_name", keys)
    .order("ts", { ascending: false })
    .limit(keys.length * 5);

  for (const row of rows ?? []) {
    if (!values.has(row.key_name)) values.set(row.key_name, row.value);
  }
  return values;
}

/** Every distinct key_name still missing a value after fetchFieldValues —
 *  used to decide which computed resolvers actually need to run, since
 *  most pages only have a handful of source: "calculated"/"platform"
 *  fields among a much larger read-direction field list. */
export function missingKeys(fields: TemplateField[], values: Map<string, FieldValue>): TemplateField[] {
  return fields.filter((f) => !values.has(f.key));
}

/** Context a computed-field resolver may need — deliberately loose (every
 *  resolver only reads the pieces it actually needs) rather than a rigid
 *  shared shape, since "self-consumption %" and "today's CO2 saved" and
 *  "EV revenue today" have almost nothing in common as calculations. */
export interface ComputeContext {
  getValue: (key: string) => FieldValue;
  device: CustomerDevice;
}

export type ComputedResolver = (ctx: ComputeContext) => FieldValue;

/** source: "calculated"/"platform"/"weather" fields each need their own
 *  real computation/lookup — there's no live register for them, by
 *  definition (equipment_templates.source says so). Every resolver here
 *  reuses logic that already exists elsewhere in the app (environmental-
 *  impact.ts, the self-consumption math monitoring-content.tsx already
 *  had, etc.) rather than inventing new math — this registry just gives
 *  every dashboard page one place to look a computed key_name up,
 *  regardless of which page added the resolver. Extended incrementally,
 *  one dashboard section's worth at a time, not pre-built speculatively —
 *  a key_name with no entry here yet renders as "no data" until its own
 *  phase adds it, same as a genuinely-missing reading would.
 *
 *  Kept as plain arithmetic on already-fetched `equipment_telemetry`
 *  values (via ctx.getValue) — never its own DB round trip — so a whole
 *  section's worth of computed fields costs nothing extra to resolve once
 *  the section's real readings are already in hand. */
export const COMPUTED_RESOLVERS: Record<string, ComputedResolver> = {
  day_co2_saved_kg: (ctx) => {
    const pv = ctx.getValue("day_pv_energy_kwh");
    return typeof pv === "number" ? co2AvoidedKg(pv) : null;
  },
  co2_saved_kg: (ctx) => {
    const pv = ctx.getValue("total_pv_energy_kwh");
    return typeof pv === "number" ? co2AvoidedKg(pv) : null;
  },
  trees_equivalent: (ctx) => {
    const pv = ctx.getValue("total_pv_energy_kwh");
    if (typeof pv !== "number") return null;
    return treesEquivalent(co2AvoidedKg(pv));
  },
  pv_total_power_w: (ctx) => {
    const l1 = ctx.getValue("inverter_l1_power_w");
    const l2 = ctx.getValue("inverter_l2_power_w");
    const l3 = ctx.getValue("inverter_l3_power_w");
    const output = ctx.getValue("inverter_output_power_w");
    if (typeof output === "number") return output;
    const parts = [l1, l2, l3].filter((v): v is number => typeof v === "number");
    return parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
  },
  day_self_use_pct: (ctx) => {
    const solarToday = ctx.getValue("day_pv_energy_kwh");
    const exportedToday = ctx.getValue("day_grid_export_energy_kwh");
    if (typeof solarToday !== "number" || solarToday <= 0) return null;
    const exported = typeof exportedToday === "number" ? exportedToday : 0;
    return Math.max(0, Math.min(100, ((solarToday - exported) / solarToday) * 100));
  },
  self_consumption_pct: (ctx) => {
    const solarToday = ctx.getValue("day_pv_energy_kwh");
    const exportedToday = ctx.getValue("day_grid_export_energy_kwh");
    if (typeof solarToday !== "number" || solarToday <= 0) return null;
    const exported = typeof exportedToday === "number" ? exportedToday : 0;
    return Math.max(0, Math.min(100, ((solarToday - exported) / solarToday) * 100));
  },
  self_sufficiency_pct: (ctx) => {
    const loadToday = ctx.getValue("day_load_energy_kwh");
    const importedToday = ctx.getValue("day_grid_import_energy_kwh");
    if (typeof loadToday !== "number" || loadToday <= 0) return null;
    const imported = typeof importedToday === "number" ? importedToday : 0;
    return Math.max(0, Math.min(100, ((loadToday - imported) / loadToday) * 100));
  },
  // Today's charge/discharge ratio — the same "day_* ratio" shape as
  // self_consumption_pct/self_sufficiency_pct above, just for the
  // battery's own round-trip loss instead of the site's energy flow.
  battery_round_trip_efficiency_pct: (ctx) => {
    const charged = ctx.getValue("day_battery_charge_energy_kwh");
    const discharged = ctx.getValue("day_battery_discharge_energy_kwh");
    if (typeof charged !== "number" || charged <= 0 || typeof discharged !== "number") return null;
    return Math.max(0, Math.min(100, (discharged / charged) * 100));
  },
  // pv5_power_w..pv8_power_w are the only "Per input (MPPT)" sub-fields
  // marked source: "calculated" (pv1-4's own power_w is a real register) —
  // plain Ohm's-law V*A on that same input's own already-fetched voltage/
  // current, not an invented figure.
  ...Object.fromEntries(
    [5, 6, 7, 8].map((n) => [
      `pv${n}_power_w`,
      ((ctx: ComputeContext) => {
        const v = ctx.getValue(`pv${n}_voltage_v`);
        const a = ctx.getValue(`pv${n}_current_a`);
        return typeof v === "number" && typeof a === "number" ? v * a : null;
      }) satisfies ComputedResolver,
    ])
  ),
};

/** Resolves every field in `fields` that fetchFieldValues didn't already
 *  find a real reading for, mutating a copy of `values` with whatever
 *  COMPUTED_RESOLVERS has an entry for. Fields with neither a real
 *  reading nor a resolver stay absent (renders "no data"). */
export function resolveComputedValues(
  fields: TemplateField[],
  values: Map<string, FieldValue>,
  device: CustomerDevice
): Map<string, FieldValue> {
  const resolved = new Map(values);
  const getValue = (key: string): FieldValue => resolved.get(key) ?? null;
  for (const field of missingKeys(fields, resolved)) {
    const resolver = COMPUTED_RESOLVERS[field.key];
    if (!resolver) continue;
    resolved.set(field.key, resolver({ getValue, device }));
  }
  return resolved;
}
