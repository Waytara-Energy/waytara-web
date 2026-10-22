// The units a customer wants to see numbers in, across the dashboard: one choice per kind of quantity (power, energy, temperature, voltage,
// current) and, when one value should differ from the rest, a choice for that value alone (an "override" keyed by the reading's key).
// Kept in profiles.ui_preferences.units. Nothing here changes what is stored or measured: a reading is converted only when it is shown.

import { QUANTITIES, convert, quantityOfUnit } from "./unit-convert";

export const PREF_QUANTITIES = ["power", "energy", "temperature", "voltage", "current"] as const;
export type PrefQuantity = (typeof PREF_QUANTITIES)[number];

export interface UnitPrefs {
  /** the unit chosen for a whole kind of quantity; a kind with no entry is shown as the device reports it */
  defaults: Partial<Record<PrefQuantity, string>>;
  /** the unit chosen for one reading, by its key (it beats the choice for its kind) */
  overrides: Record<string, string>;
}

export const DEFAULT_UNIT_PREFS: UnitPrefs = { defaults: {}, overrides: {} };

export const MAX_OVERRIDES = 60;
const KEY = /^[A-Za-z0-9_.:-]{1,80}$/;

const unitsOf = (quantity: string): string[] => QUANTITIES.find((q) => q.id === quantity)?.units.map((u) => u.id) ?? [];
const labelOf = (quantity: string, unit: string): string => QUANTITIES.find((q) => q.id === quantity)?.units.find((u) => u.id === unit)?.label ?? unit;

/** The units the person can choose between for each kind (the ones that make sense on a solar dashboard; any other unit of the kind is still
 *  understood if one was stored). */
const OFFERED: Record<PrefQuantity, string[]> = { power: ["W", "kW", "MW"], energy: ["Wh", "kWh", "MWh", "MJ"], temperature: ["C", "F", "K"], voltage: ["V", "kV"], current: ["mA", "A"] };
export const UNIT_CHOICES: Record<PrefQuantity, { id: string; label: string }[]> = Object.fromEntries(
  PREF_QUANTITIES.map((q) => [q, (QUANTITIES.find((x) => x.id === q)?.units ?? []).filter((u) => OFFERED[q].includes(u.id)).map((u) => ({ id: u.id, label: u.label }))]),
) as Record<PrefQuantity, { id: string; label: string }[]>;

export const QUANTITY_LABEL: Record<PrefQuantity, string> = { power: "Power", energy: "Energy", temperature: "Temperature", voltage: "Voltage", current: "Current" };

export function parseUnitPrefs(raw: unknown): UnitPrefs {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const units = root.units && typeof root.units === "object" && !Array.isArray(root.units) ? (root.units as Record<string, unknown>) : root;
  const defaults: UnitPrefs["defaults"] = {};
  const d = units.defaults && typeof units.defaults === "object" ? (units.defaults as Record<string, unknown>) : {};
  for (const q of PREF_QUANTITIES) if (typeof d[q] === "string" && unitsOf(q).includes(d[q] as string)) defaults[q] = d[q] as string;

  const overrides: UnitPrefs["overrides"] = {};
  const o = units.overrides && typeof units.overrides === "object" ? (units.overrides as Record<string, unknown>) : {};
  const known = new Set(PREF_QUANTITIES.flatMap((q) => unitsOf(q)));
  for (const [key, unit] of Object.entries(o)) {
    if (Object.keys(overrides).length >= MAX_OVERRIDES) break;
    if (KEY.test(key) && typeof unit === "string" && known.has(unit)) overrides[key] = unit;
  }
  return { defaults, overrides };
}

export const hasUnitChoices = (p: UnitPrefs): boolean => Object.keys(p.defaults).length > 0 || Object.keys(p.overrides).length > 0;

/** How many decimals read well for a number shown in this unit (when it was converted; an unconverted number keeps its own formatting). */
export function decimalsFor(unit: string): number {
  switch (unit) {
    case "W": case "Wh": case "mV": case "mA": case "s": return 0;
    case "kW": case "kWh": case "A": return 2;
    case "MW": case "MWh": case "kV": case "kA": return 3;
    default: return 1; // MJ, V, degrees, Kelvin
  }
}

export interface Shown {
  value: number;
  /** the unit to print next to it */
  unit: string;
  /** true when the value was converted to another unit than the device's own */
  converted: boolean;
  /** how many decimals to print when converted (decimalsFor of the new unit) */
  decimals: number;
}

/** A reading in its own unit, ready to show in the unit the person chose for it (or as it is, when they chose nothing or it cannot convert). */
export function displayValue(value: number, nativeUnit: string | null | undefined, prefs: UnitPrefs, key?: string | null): Shown {
  const own: Shown = { value, unit: nativeUnit ?? "", converted: false, decimals: 0 };
  const native = quantityOfUnit(nativeUnit);
  if (!native || !Number.isFinite(value)) return own;
  const quantity = native.quantity as PrefQuantity;
  if (!PREF_QUANTITIES.includes(quantity)) return own;
  const wanted = (key ? prefs.overrides[key] : undefined) ?? prefs.defaults[quantity];
  if (!wanted || wanted === native.unit || !unitsOf(quantity).includes(wanted)) return own;
  const converted = convert(value, quantity, native.unit, wanted);
  if (converted === null) return own;
  return { value: converted, unit: labelOf(quantity, wanted), converted: true, decimals: decimalsFor(wanted) };
}

/** The same choice for a whole series (chart data): the factor-by-factor mapping of each value and the unit label to print. Null when nothing
 *  is converted. Temperature is not a pure factor, so this converts each value through the same function. */
export function seriesConverter(nativeUnit: string | null | undefined, prefs: UnitPrefs, key?: string | null): { unit: string; decimals: number; map: (v: number) => number } | null {
  const probe = displayValue(1, nativeUnit, prefs, key);
  if (!probe.converted) return null;
  return { unit: probe.unit, decimals: probe.decimals, map: (v) => displayValue(v, nativeUnit, prefs, key).value };
}

/** The unit text a reading will be shown in, without a number (for headings and axes). */
export const shownUnit = (nativeUnit: string | null | undefined, prefs: UnitPrefs, key?: string | null): string => displayValue(1, nativeUnit, prefs, key).unit;

/** "1,234.5 kW", given the formatter for a number that was not converted. */
export function formatShown(shown: Shown, ownDecimals: number, withUnit = true): string {
  const decimals = shown.converted ? shown.decimals : ownDecimals;
  const num = decimals > 0 ? shown.value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Math.round(shown.value).toLocaleString("en-IN");
  return withUnit && shown.unit ? `${num} ${shown.unit}` : num;
}

export const quantityLabelOf = (unit: string | null | undefined): PrefQuantity | null => {
  const q = quantityOfUnit(unit)?.quantity as PrefQuantity | undefined;
  return q && PREF_QUANTITIES.includes(q) ? q : null;
};
