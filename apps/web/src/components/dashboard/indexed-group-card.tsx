import type { TemplateField } from "@/lib/template-field-format";

/** A single numbered item within a repeating group ("Pack 3", "String 12",
 *  ...) and the sub-field key that repeats across every item ("voltage_v",
 *  "current_a", ...), once the shared `{N}`-shaped prefix/suffix around
 *  the index digits is stripped out. */
export interface IndexedField {
  index: number;
  subKey: string;
  field: TemplateField;
}

// Splits "battery_pack3_max_cell_voltage_v" into { prefix: "battery_pack",
// index: 3, suffix: "_max_cell_voltage_v" } — the same numbered-item shape
// PvStringComparison's own hand-written field-group maps
// (PV_STRING_FIELDS/PV_SUBSTRING_FIELDS/MICRO_MODULE_FIELDS) always had,
// just detected from the real key_name instead of a hardcoded map. The
// first digit run in the key is taken as the index — every repeating
// group in the workbook (battery_packN_, pvN_, pv_stringN_, micro_panelN_)
// only ever has the one number embedded, so this doesn't need to be
// cleverer than "first digit run wins".
function parseIndexedKey(key: string): { prefix: string; index: number; suffix: string } | null {
  const match = key.match(/^(.*?)(\d+)(_.*)$/);
  if (!match) return null;
  const [, prefix, numStr, suffix] = match;
  return { prefix, index: Number(numStr), suffix };
}

/** Groups `fields` by their embedded numeric index if (and only if) every
 *  field in the group matches the same `prefix{N}suffix` shape — a mixed
 *  group (some fields indexed, some not) isn't a real "repeating item"
 *  group, so this bails out to null and the caller falls back to a flat
 *  MetricListCard instead of guessing. */
export function groupByIndex(fields: TemplateField[]): { prefix: string; items: Map<number, IndexedField[]> } | null {
  if (fields.length === 0) return null;
  const parsed = fields.map((field) => {
    const p = parseIndexedKey(field.key);
    return p ? { field, ...p } : null;
  });
  if (parsed.some((p) => p === null)) return null;

  const prefix = parsed[0]!.prefix;
  if (parsed.some((p) => p!.prefix !== prefix)) return null;

  const items = new Map<number, IndexedField[]>();
  for (const p of parsed as { field: TemplateField; prefix: string; index: number; suffix: string }[]) {
    const list = items.get(p.index) ?? [];
    list.push({ index: p.index, subKey: p.suffix, field: p.field });
    items.set(p.index, list);
  }
  // Canonical sub-field order taken from the lowest index present, applied
  // to every item — keeps e.g. "Voltage" landing in the same row position
  // across every pack card instead of each item ordering its own fields
  // independently (which the DB's own row order doesn't guarantee stays
  // aligned once show_for_user/verification differs slightly per device).
  const firstIndex = Math.min(...items.keys());
  const order = (items.get(firstIndex) ?? []).map((f) => f.subKey);
  for (const list of items.values()) {
    list.sort((a, b) => order.indexOf(a.subKey) - order.indexOf(b.subKey));
  }
  return { prefix, items };
}

