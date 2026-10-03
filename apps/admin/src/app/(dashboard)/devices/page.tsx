import Link from "next/link";
import { LibraryBig, History } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@waytara/ui/button";
import { StockTable, type StockRow } from "./stock-table";

// Admin-only route (enforced in middleware.ts). Originally a bare 4-column
// device_types catalog (Task 8.4); the underlying table is now
// `equipment_inventory` — a real inventory record (brand/model/specs
// alongside serial number, quantity, unit of measure, purchase price and
// supplier), not just a name employees pick from a dropdown. Rendered as a
// searchable/filterable table (see ./stock-table.tsx) rather than one long
// always-expanded form per row, now that there are ~20 fields per item.
//
// Registers no longer live here at all — equipment_metrics scopes them
// per physical DEVICE, not per stock model (a model can't have "its"
// registers since two units of the same model may be wired differently,
// e.g. on-grid vs off-grid). Mapping registers now happens per device,
// during onboarding (variant selection clones the matching
// equipment_templates rows in) or later via that device's own "Edit
// Registers" page.
export default async function DevicesPage() {
  const supabase = await createClient();

  const { data: stockItems } = await supabase
    .from("equipment_inventory")
    .select(
      "id, name, category, brand, model, model_number, manufacturer, serial_number, status, power_capacity_value, power_capacity_unit, size_value, size_unit, technical_specs, warranty_info, quantity, pack_size, primary_uom, purchase_price_amount, unit_price, purchase_date, supplier, po_reference, phase_count"
    )
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every device model in inventory — specs, purchase details, and inventory tracking. What employees pick
            from during Site &amp; Device Setup.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/devices/catalog">
              <LibraryBig className="size-4" />
              Equipment Enum
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/devices/settings-history">
              <History className="size-4" />
              Settings History
            </Link>
          </Button>
        </div>
      </div>

      <StockTable items={(stockItems ?? []) as StockRow[]} />
    </div>
  );
}
