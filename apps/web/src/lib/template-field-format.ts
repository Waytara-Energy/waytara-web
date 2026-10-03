/**
 * Pure presentation helpers for TemplateField/FieldValue (see
 * template-fields.ts) — split out with no "server-only" guard, the same
 * device-display.ts/selected-site.ts split this app already uses, so a
 * client component (e.g. an interactive card) can format a value without
 * pulling in template-fields.ts's Supabase server client.
 */

export interface TemplateField {
  key: string;
  label: string;
  unit: string | null;
  valueKind: string;
  enumRef: string | null;
  source: string | null;
}

export type FieldValue = number | string | null;

// Units get one bucket of decimal precision each — equipment_templates
// doesn't carry a `decimals` column the way the old hand-written
// telemetry-catalog.ts did per-field, so this infers a reasonable default
// from the unit string instead. Not pixel-identical to the old hand-tuned
// values, just consistent.
function decimalsForUnit(unit: string | null): number {
  if (!unit) return 0;
  const u = unit.toLowerCase();
  if (u.includes("kwh") || u.includes("kvarh") || u === "kw" || u === "ah") return 1;
  if (u === "v" || u === "a" || u === "hz" || u === "°c" || u === "%" || u === "kvar" || u === "var") return 2;
  return 0;
}

function formatTimestamp(value: string, valueKind: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (valueKind === "date") return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (valueKind === "time") return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** value_kind-aware formatting — the DB-driven counterpart to the old
 *  telemetry-catalog.ts's formatValue, which only ever handled plain
 *  numbers. Every dashboard field now flowing through here can be text,
 *  an enum code (pre-resolved to its label by the caller — this function
 *  never does the enum_ref -> equipment_enum lookup itself, since that
 *  needs a DB round trip its own presentation-only sibling shouldn't
 *  have), a bool, a timestamp/date/time, or a currency figure, not just a
 *  number. */
export function formatFieldValue(value: FieldValue, field: TemplateField): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (field.valueKind) {
    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) return "—";
      const decimals = decimalsForUnit(field.unit);
      const rounded = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toLocaleString("en-IN");
      return field.unit ? `${rounded} ${field.unit}` : rounded;
    }
    case "currency": {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) return "—";
      return `${field.unit ?? "₹"}${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    }
    case "bool":
      return Number(value) === 1 || value === "true" ? "Yes" : "No";
    case "timestamp":
    case "date":
    case "time":
      return typeof value === "string" ? formatTimestamp(value, field.valueKind) : String(value);
    case "enum":
      // Already resolved to its label by the caller (see
      // resolveEnumLabels in the components that render enum fields) —
      // by the time it reaches here it's just display text.
      return String(value);
    default:
      return String(value);
  }
}
