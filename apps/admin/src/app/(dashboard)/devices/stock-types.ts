/**
 * What the stock pages share. A MODEL is a product in the catalog (equipment_inventory); its stock is a set of UNITS (stock_units): one row per
 * serial-numbered unit, or one row per lot (a batch with an id and a quantity). A unit follows a status through its life.
 */

export interface StockRow {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  model_number: string | null;
  manufacturer: string | null;
  tracking: string;
  reorder_level: number;
  power_capacity_value: number | null;
  power_capacity_unit: string | null;
  size_value: number | null;
  size_unit: string | null;
  technical_specs: unknown;
  warranty_info: unknown;
  quantity: number;
  pack_size: number | null;
  primary_uom: string | null;
  unit_price: number | null;
  phase_count: number | null;
  manual_document_path: string | null;
  manual_document_name: string | null;
  manual_document_type: string | null;
  manual_document_size: number | null;
  datasheet_document_path: string | null;
  datasheet_document_name: string | null;
  datasheet_document_type: string | null;
  datasheet_document_size: number | null;
}

export const STOCK_COLUMNS =
  "id, name, category, brand, model, model_number, manufacturer, tracking, reorder_level, power_capacity_value, power_capacity_unit, size_value, size_unit, technical_specs, warranty_info, quantity, pack_size, primary_uom, unit_price, phase_count, manual_document_path, manual_document_name, manual_document_type, manual_document_size, datasheet_document_path, datasheet_document_name, datasheet_document_type, datasheet_document_size";

/** One serial-numbered unit, or one lot, of a model. */
export interface UnitRow {
  id: string;
  model_id: string;
  serial_number: string;
  quantity: number;
  remaining: number;
  status: string;
  receipt_id: string | null;
  location: string | null;
  notes: string | null;
  customer_id: string | null;
  site_id: string | null;
  reserved_at: string | null;
  installed_at: string | null;
  created_at: string;
}

export const UNIT_COLUMNS = "id, model_id, serial_number, quantity, remaining, status, receipt_id, location, notes, customer_id, site_id, reserved_at, installed_at, created_at";

/** The life of a unit, in the order it usually goes. */
export const UNIT_STATUSES = ["in_stock", "reserved", "installed", "repair", "damaged", "returned", "retired", "used_up"] as const;

/** The states an admin can move a unit to by hand (the others happen when it is reserved or installed). */
export const MANUAL_STATUSES = ["in_stock", "repair", "damaged", "returned", "retired"] as const;

const STATUS_LABELS: Record<string, string> = { in_stock: "In stock", used_up: "Used up" };
export const statusLabel = (s: string) => STATUS_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

export const TRACKING_LABEL: Record<string, string> = { serial: "By serial number", lot: "By lot" };

/** The two categories the system itself depends on: they are always offered and can never be removed. */
export const PROTECTED_CATEGORIES: readonly string[] = ["solar_inverter", "ev_charger"];

/**
 * How a category reads on screen. The stored name never changes (the database and the dashboards look for "solar_inverter" and "ev_charger"
 * exactly); only these two are written out for people.
 */
const CATEGORY_LABELS: Record<string, string> = { solar_inverter: "Solar Inverter", ev_charger: "EV Charger" };
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

/** What a model's stock adds up to, from its units. */
export interface StockSummary {
  /** available to give out (in stock) */
  available: number;
  /** held for a customer */
  reserved: number;
  /** at a customer's site (a lot counts the pieces drawn from it) */
  installed: number;
  /** repair, damaged, returned: not available, not at a customer */
  attention: number;
  /** units or lots on record, whatever their state */
  lines: number;
}

export function summarizeUnits(units: Pick<UnitRow, "status" | "quantity" | "remaining">[]): StockSummary {
  const s: StockSummary = { available: 0, reserved: 0, installed: 0, attention: 0, lines: units.length };
  for (const u of units) {
    if (u.status === "in_stock") s.available += u.remaining;
    else if (u.status === "reserved") s.reserved += u.quantity;
    else if (u.status === "installed") s.installed += u.quantity;
    else if (["repair", "damaged", "returned"].includes(u.status)) s.attention += u.remaining;
    // a lot also counts what has been drawn from it
    if (u.quantity > 1 && u.status !== "installed" && u.status !== "reserved") s.installed += u.quantity - u.remaining;
  }
  return s;
}

/** A model out of stock, or at or below its reorder level. */
export function stockLevel(model: Pick<StockRow, "reorder_level">, available: number): "out" | "low" | "ok" {
  if (available <= 0) return "out";
  if (model.reorder_level > 0 && available <= model.reorder_level) return "low";
  return "ok";
}

export function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

/** "Deye SUN-8K", "Canadian Solar": the brand or manufacturer with the model, for a line under a name. */
export function makeAndModel(i: Pick<StockRow, "brand" | "manufacturer" | "model">): string {
  const make = i.brand || i.manufacturer || "";
  return [make, i.model].filter(Boolean).join(" ") || "—";
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
