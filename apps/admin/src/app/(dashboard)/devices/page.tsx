import { createClient } from "@waytara/supabase/server";
import { StockTable, type StockRow } from "./stock-table";

// Admin-only route (enforced in middleware.ts). Originally a bare 4-column
// device_types catalog (Task 8.4); the underlying table is now `stock` —
// a real inventory record (brand/model/specs alongside serial number,
// quantity, unit of measure, purchase price and supplier), not just a
// name employees pick from a dropdown. Rendered as a searchable/filterable
// table (see ./stock-table.tsx) rather than one long always-expanded form
// per row, now that there are ~20 fields per item.
export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: stockItems } = await supabase
    .from("stock")
    .select(
      "id, name, category, brand, model, model_number, manufacturer, serial_number, status, power_capacity_value, power_capacity_unit, size_value, size_unit, technical_specs, warranty_info, quantity, pack_size, primary_uom, purchase_price_amount, unit_price, purchase_date, supplier, po_reference, device_parameters(id, parameter_key, parameter_name, unit, category, modbus_register, is_required)"
    )
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stock Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every device model in inventory — specs, purchase details, and the instruments each one reports. What
          employees pick from during Site &amp; Device Setup, and what customers see readings for.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm text-primary">Saved.</div>
      )}

      <StockTable items={(stockItems ?? []) as StockRow[]} />
    </div>
  );
}
