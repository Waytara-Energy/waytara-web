import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "./selected-site";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface EnumOption {
  code: string;
  label: string;
}

export interface SettingField {
  key: string;
  name: string;
  category: string;
  unit: string | null;
  description: string | null;
  valueKind: string;
  minRole: string;
  regulated: boolean;
  enumRef: string | null;
  validMin: number | null;
  validMax: number | null;
  currentValue: string | null;
}

export interface DeviceSettingsCatalog {
  fieldsByCategory: Map<string, SettingField[]>;
  enumOptionsByRef: Map<string, EnumOption[]>;
}

const CATEGORY_LABELS: Record<string, string> = {
  battery: "Battery",
  generator: "Generator",
  grid: "Grid",
  solar: "Solar",
  system: "System",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Catalog-driven write-side settings for one device — instrument_catalog
 *  rows this device's stock model actually maps (device_parameter_map,
 *  is_enabled) with direction='write', grouped by category and excluding
 *  whatever this specific install's device_feature_flags disable. TOU's
 *  own tou_slot* keys are deliberately excluded here — those are edited
 *  through setting_presets (see tou-preset-picker.tsx), never as raw
 *  fields, since their write registers are min_role 'employee'. */
export async function fetchDeviceSettingFields(supabase: SupabaseServerClient, device: CustomerDevice): Promise<DeviceSettingsCatalog> {
  const stockId = device.deviceType?.id;
  const empty: DeviceSettingsCatalog = { fieldsByCategory: new Map(), enumOptionsByRef: new Map() };
  if (!stockId) return empty;

  const [{ data: mapRows }, { data: disabledFlags }] = await Promise.all([
    supabase
      .from("device_parameter_map")
      .select(
        "instrument_key, instrument_catalog!inner(name, category, unit, description, value_kind, min_role, regulated, enum_ref, valid_min, valid_max, direction)"
      )
      .eq("stock_id", stockId)
      .eq("is_enabled", true)
      .eq("instrument_catalog.direction", "write"),
    supabase.from("device_feature_flags").select("category").eq("device_id", device.id).eq("is_enabled", false),
  ]);

  const disabledCategories = new Set((disabledFlags ?? []).map((f) => f.category));
  const rows = (mapRows ?? []).filter(
    (r) => !r.instrument_key.startsWith("tou_slot") && !disabledCategories.has(r.instrument_catalog.category)
  );
  if (rows.length === 0) return empty;

  const keys = rows.map((r) => r.instrument_key);
  const enumRefs = Array.from(new Set(rows.map((r) => r.instrument_catalog.enum_ref).filter((r): r is string => Boolean(r))));

  const [{ data: settingsRows }, { data: enumRows }] = await Promise.all([
    supabase
      .from("device_settings")
      .select("setting_key, setting_value, ts")
      .eq("device_id", device.id)
      .in("setting_key", keys)
      .order("ts", { ascending: true }), // ascending so the last write per key (assigned below) wins.
    enumRefs.length > 0
      ? supabase.from("instrument_enum_values").select("enum_ref, code, label").in("enum_ref", enumRefs).order("code")
      : Promise.resolve({ data: [] }),
  ]);

  const currentByKey = new Map<string, string>();
  for (const row of settingsRows ?? []) currentByKey.set(row.setting_key, row.setting_value);

  const enumOptionsByRef = new Map<string, EnumOption[]>();
  for (const row of enumRows ?? []) {
    const list = enumOptionsByRef.get(row.enum_ref) ?? [];
    list.push({ code: row.code, label: row.label });
    enumOptionsByRef.set(row.enum_ref, list);
  }

  const fieldsByCategory = new Map<string, SettingField[]>();
  for (const row of rows) {
    const c = row.instrument_catalog;
    const field: SettingField = {
      key: row.instrument_key,
      name: c.name,
      category: c.category,
      unit: c.unit,
      description: c.description,
      valueKind: c.value_kind,
      minRole: c.min_role,
      regulated: c.regulated,
      enumRef: c.enum_ref,
      validMin: c.valid_min,
      validMax: c.valid_max,
      currentValue: currentByKey.get(row.instrument_key) ?? null,
    };
    const list = fieldsByCategory.get(c.category) ?? [];
    list.push(field);
    fieldsByCategory.set(c.category, list);
  }
  for (const list of fieldsByCategory.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  return { fieldsByCategory, enumOptionsByRef };
}
