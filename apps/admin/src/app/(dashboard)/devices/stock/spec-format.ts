/**
 * The technical details and the warranty of a stock item are stored as small JSON objects (name -> value), but nobody should have to type JSON: the
 * form shows them as rows of a name and a value. These are the conversions between the two, kept pure so they can be checked on their own.
 *
 * A name is stored in lower snake case ("ip_rating", "efficiency_pct", "voc_v") and shown the way a person writes it ("IP rating", "Efficiency (%)",
 * "VOC (V)"); turning a shown name back gives the stored one again, so a row an admin did not touch is saved exactly as it was.
 */

const ACRONYMS: Record<string, string> = { ip: "IP", ocpp: "OCPP", pv: "PV", mppt: "MPPT", dc: "DC", ac: "AC", soc: "SOC", eol: "EOL", dod: "DOD", voc: "VOC", isc: "ISC", led: "LED", mcb: "MCB", spd: "SPD", lfp: "LFP", ev: "EV", id: "ID" };
const UNITS: Record<string, string> = { v: "V", a: "A", kw: "kW", kwh: "kWh", ka: "kA", pct: "%", years: "years", months: "months", kg: "kg", mm: "mm", hz: "Hz", w: "W", wh: "Wh" };

/** "max_pv_input_kw" -> "Max PV input (kW)". */
export function labelFromKey(key: string): string {
  const parts = key.split("_").filter(Boolean);
  if (parts.length === 0) return "";
  let unit = "";
  if (parts.length > 1 && UNITS[parts[parts.length - 1]!]) unit = UNITS[parts.pop()!]!;
  const words = parts.map((p, i) => ACRONYMS[p] ?? (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p));
  return unit ? `${words.join(" ")} (${unit})` : words.join(" ");
}

/** "Max PV input (kW)" -> "max_pv_input_kw". */
export function toKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/%/g, " pct ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** What a person typed in a value box, as the value to store: numbers and yes/no become numbers and booleans, anything else stays text. */
export function parseValue(text: string): unknown {
  const t = text.trim();
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(t)) return Number(t);
  if (/^(yes|true)$/i.test(t)) return true;
  if (/^(no|false)$/i.test(t)) return false;
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }
  return t;
}

/** A stored value, as it is shown in a value box. */
export function valueToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export interface SpecRow {
  /** only for React's keys: it is never stored */
  id: number;
  name: string;
  value: string;
}

/** The rows of a stored object (a stored value that is not an object, or no value, gives no rows). */
export function rowsFromObject(obj: unknown, startId = 1, skip: readonly string[] = []): SpecRow[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj as Record<string, unknown>)
    .filter(([k]) => !skip.includes(k))
    .map(([k, v], i) => ({ id: startId + i, name: labelFromKey(k), value: valueToText(v) }));
}

/** The object to store for some rows: rows without a name or a value are left out; a name used twice keeps its last row. */
export function objectFromRows(rows: readonly SpecRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const key = toKey(r.name);
    if (!key || !r.value.trim()) continue;
    out[key] = parseValue(r.value);
  }
  return out;
}

/** The names used by more than one row (to tell the admin). */
export function duplicateNames(rows: readonly SpecRow[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const r of rows) {
    const key = toKey(r.name);
    if (!key || !r.value.trim()) continue;
    if (seen.has(key)) dup.add(labelFromKey(key));
    seen.add(key);
  }
  return [...dup];
}

/** The specifications worth offering as one-click rows for a kind of item (by its category), most useful first. */
export function specSuggestions(category: string): string[] {
  const c = category.toLowerCase();
  if (c.includes("inverter")) return ["mppt_count", "max_pv_input_kw", "ip_rating", "phase"];
  if (c.includes("panel")) return ["cell_type", "cells", "efficiency_pct", "voc_v", "isc_a"];
  if (c.includes("batter")) return ["chemistry", "nominal_voltage", "usable_kwh", "dod"];
  if (c.includes("ev") || c.includes("charger")) return ["connector", "current", "ip_rating", "ocpp"];
  if (c.includes("cable") || c.includes("wir")) return ["conductor", "cores", "sheath", "voltage"];
  if (c.includes("switch") || c.includes("protect")) return ["poles", "curve", "breaking_capacity_ka"];
  if (c.includes("meter")) return ["accuracy", "interface", "protocol"];
  return ["ip_rating", "voltage", "current"];
}

/** The warranty fields the form has of its own, and the other warranty details that get rows. */
export const WARRANTY_FIELD_KEYS = ["years", "type", "provider"] as const;
export const WARRANTY_TYPES: { value: string; label: string }[] = [
  { value: "standard_replacement", label: "Standard replacement" },
  { value: "onsite_service", label: "On-site service" },
  { value: "pro_rata", label: "Pro-rata" },
  { value: "limited", label: "Limited warranty" },
];
export const WARRANTY_SUGGESTIONS = ["product_years", "performance_years", "cycle_life"];
