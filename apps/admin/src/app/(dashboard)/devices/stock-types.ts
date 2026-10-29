/** What the stock catalog pages share: the row of an inventory item, the columns that read it, the statuses, and a few words. */

export interface StockRow {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  model_number: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  status: string;
  power_capacity_value: number | null;
  power_capacity_unit: string | null;
  size_value: number | null;
  size_unit: string | null;
  technical_specs: unknown;
  warranty_info: unknown;
  quantity: number;
  pack_size: number | null;
  primary_uom: string | null;
  purchase_price_amount: number | null;
  unit_price: number | null;
  purchase_date: string | null;
  supplier: string | null;
  po_reference: string | null;
  po_document_path: string | null;
  po_document_name: string | null;
  po_document_type: string | null;
  po_document_size: number | null;
  phase_count: number | null;
}

export const STOCK_COLUMNS =
  "id, name, category, brand, model, model_number, manufacturer, serial_number, status, power_capacity_value, power_capacity_unit, size_value, size_unit, technical_specs, warranty_info, quantity, pack_size, primary_uom, purchase_price_amount, unit_price, purchase_date, supplier, po_reference, po_document_path, po_document_name, po_document_type, po_document_size, phase_count";

export const STATUS_OPTIONS = ["in_stock", "allocated", "installed", "damaged", "returned"] as const;

/**
 * How a category reads on screen. The stored name never changes (the database and the dashboards look for "solar_inverter" and "ev_charger"
 * exactly); only these two are written out for people.
 */
const CATEGORY_LABELS: Record<string, string> = { solar_inverter: "Solar Inverter", ev_charger: "EV Charger" };
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

export const statusLabel = (s: string) => s.replace(/_/g, " ");

/** An item that is marked in stock but has none left. */
export const isOutOfStock = (i: StockRow) => i.status === "in_stock" && i.quantity <= 0;

export function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

/** "Deye SUN-8K", "Canadian Solar": the brand or manufacturer with the model, for a line under a name. */
export function makeAndModel(i: Pick<StockRow, "brand" | "manufacturer" | "model">): string {
  const make = i.brand || i.manufacturer || "";
  return [make, i.model].filter(Boolean).join(" ") || "—";
}
