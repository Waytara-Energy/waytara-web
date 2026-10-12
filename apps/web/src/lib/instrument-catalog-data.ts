import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "./selected-site";
import { settingPlace, type ConfigRow, type SettingArea } from "./setting-values";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

import type { EnumOption } from "./enum-labels";
export { lookupEnumLabel } from "./enum-labels";
export type { EnumOption };

export interface SettingField {
  key: string;
  name: string;
  category: string;
  unit: string | null;
  valueKind: string;
  enumRef: string | null;
  validMin: number | null;
  validMax: number | null;
  /** The template's group (Grid charging, Time of Use...), and which tab it belongs to for a solar inverter. */
  groupName: string | null;
  area: SettingArea;
  /** The block of rows it sits in on that page, and that block's position (the inverter's own screen order). */
  section: string;
  sectionOrder: number;
  /** The last row the agent read from the inverter and the last row somebody asked for, oldest first: enough to say how sure the page is. */
  recent: ConfigRow[];
}

/** One line of a device's settings log: a change somebody asked for, or what the inverter answered. Start-up reads are not listed. */
export interface ConfigLogRow {
  key: string;
  value: string;
  previous: string | null;
  source: string | null;
  notes: string | null;
  ts: string;
}

/** How many log lines the page starts with (newest first). */
export const SETTINGS_LOG_LIMIT = 200;

export interface DeviceSettingsCatalog {
  fieldsByCategory: Map<string, SettingField[]>;
  enumOptionsByRef: Map<string, EnumOption[]>;
  /** The settings log, newest first. */
  log: ConfigLogRow[];
}

const CATEGORY_LABELS: Record<string, string> = {
  Battery: "Battery",
  Generator: "Generator",
  Grid: "Grid",
  Solar: "Solar",
  System: "System",
  Inverter: "Inverter",
  Load: "Load",
  Diagnostics: "Diagnostics",
  "Metering & Export": "Metering & Export",
  "Energy Management": "Energy Management",
  "My Settings": "My Settings",
  "System Checks": "System Checks",
  "Device Info": "Device Info",
  "Installer Settings (view only)": "Installer Settings",
};

const isAgentSource = (source: string | null) => (source ?? "").startsWith("agent");

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Write-direction fields for one device — equipment_metrics rows this
 *  specific installation actually has (show_for_user = true), joined to
 *  equipment_templates for display metadata, grouped by category. There's
 *  no separate per-installation "feature flag" layer anymore: a category
 *  is simply absent here when this device's own metrics rows don't
 *  include it. Time-of-Use's slot fields render the same as any other
 *  write field now (no preset layer) — see equipment_templates' "Energy
 *  Management" category, "Time of Use" group. */
export async function fetchDeviceSettingFields(supabase: SupabaseServerClient, device: CustomerDevice): Promise<DeviceSettingsCatalog> {
  const empty: DeviceSettingsCatalog = { fieldsByCategory: new Map(), enumOptionsByRef: new Map(), log: [] };

  const { data: metricRows } = await supabase
    .from("equipment_metrics")
    .select("key_name, category, enum_ref, valid_min, valid_max, equipment_templates!inner(display_name, unit, value_kind, group_name)")
    .eq("equipment_id", device.id)
    .eq("direction", "write")
    .eq("show_for_user", true);

  // Account-level items (tariffs, notifications) and values with no register behind them (the clock) are not inverter settings.
  const rows = (metricRows ?? []).filter((r) => r.equipment_templates.group_name !== "Account" && !["set", "datetime"].includes(r.equipment_templates.value_kind ?? ""));
  if (rows.length === 0) return empty;

  const keys = rows.map((r) => r.key_name);
  const enumRefs = Array.from(new Set(rows.map((r) => r.enum_ref).filter((r): r is string => Boolean(r))));

  const [{ data: settingsRows }, enumOptionsByRef] = await Promise.all([
    supabase
      .from("equipment_configs")
      .select("key_name, setting_value, previous_value, notes, source, ts")
      .eq("equipment_id", device.id)
      .in("key_name", keys)
      .order("ts", { ascending: true }), // ascending: the last row of each kind per key is kept below.
    fetchEnumOptions(supabase, enumRefs),
  ]);

  // Per key, the newest row from the agent and the newest from anyone else.
  const lastAgent = new Map<string, ConfigRow>();
  const lastRequest = new Map<string, ConfigRow>();
  const log: ConfigLogRow[] = [];
  for (const row of settingsRows ?? []) {
    const r: ConfigRow = { value: row.setting_value, source: row.source, ts: row.ts };
    (isAgentSource(row.source) ? lastAgent : lastRequest).set(row.key_name, r);
    if (row.source !== "agent_initial_read") log.push({ key: row.key_name, value: row.setting_value, previous: row.previous_value, source: row.source, notes: row.notes, ts: row.ts });
  }
  log.reverse(); // the rows came oldest first

  const fieldsByCategory = new Map<string, SettingField[]>();
  for (const row of rows) {
    const t = row.equipment_templates;
    const field: SettingField = {
      key: row.key_name,
      name: t.display_name,
      category: row.category,
      unit: t.unit,
      valueKind: t.value_kind ?? "text",
      enumRef: row.enum_ref,
      validMin: row.valid_min,
      validMax: row.valid_max,
      groupName: t.group_name,
      ...(() => {
        const place = settingPlace(t.group_name, row.key_name);
        return { area: place.area, section: place.section, sectionOrder: place.order };
      })(),
      recent: [lastAgent.get(row.key_name), lastRequest.get(row.key_name)].filter((r): r is ConfigRow => !!r).sort((a, b) => a.ts.localeCompare(b.ts)),
    };
    const list = fieldsByCategory.get(row.category) ?? [];
    list.push(field);
    fieldsByCategory.set(row.category, list);
  }
  for (const list of fieldsByCategory.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  return { fieldsByCategory, enumOptionsByRef, log: log.slice(0, SETTINGS_LOG_LIMIT) };
}

/** Every read-direction key this device actually reports —
 *  equipment_metrics rows for this device with show_for_user = true.
 *  Used to filter the presentation field lists (telemetry-catalog.ts /
 *  ev-charger-catalog.ts) down to what this specific installation
 *  genuinely has, the same role fetchReadKeys always played, just backed
 *  by the per-device table directly instead of a per-model table minus a
 *  feature-flag subtraction. */
export async function fetchReadKeys(supabase: SupabaseServerClient, device: CustomerDevice): Promise<Set<string>> {
  const { data: metricRows } = await supabase
    .from("equipment_metrics")
    .select("key_name")
    .eq("equipment_id", device.id)
    .eq("direction", "read")
    .eq("show_for_user", true);

  return new Set((metricRows ?? []).map((r) => r.key_name));
}

/** Batch enum-code -> label lookup, shared by the Settings form's
 *  dropdowns and any read-side display of an enum-valued reading. */
export async function fetchEnumOptions(supabase: SupabaseServerClient, enumRefs: string[]): Promise<Map<string, EnumOption[]>> {
  const enumOptionsByRef = new Map<string, EnumOption[]>();
  if (enumRefs.length === 0) return enumOptionsByRef;

  const { data: enumRows } = await supabase.from("equipment_enum").select("enum_ref, code, label").in("enum_ref", enumRefs).order("code");
  for (const row of enumRows ?? []) {
    const list = enumOptionsByRef.get(row.enum_ref) ?? [];
    list.push({ code: row.code, label: row.label });
    enumOptionsByRef.set(row.enum_ref, list);
  }
  return enumOptionsByRef;
}

/** Convenience for a single enum_ref — looks up one code's label, falling
 *  back to the raw code string (still better than nothing) if it's
 *  missing from equipment_enum or the code itself is unrecognized. */
