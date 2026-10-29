import Link from "next/link";
import { LibraryBig, History } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@/components/ui/button";
import { StockOverview, type Allocation } from "./stock-overview";
import { StockTable } from "./stock-table";
import { STOCK_COLUMNS, type StockRow } from "./stock-types";

// Admin-only route (enforced in middleware.ts). The stock catalog: `equipment_inventory` is a real inventory record (brand/model/specs alongside
// serial number, quantity, unit of measure, purchase price and supplier), not just a name employees pick from a dropdown. The cards above the table
// are the overview (how much there is, what is in use, what needs attention, what it is worth); a row of the table opens that item's own page
// (/devices/stock/[id]) where it is edited and where its allocations are listed.
//
// Registers no longer live here at all — equipment_metrics scopes them per physical DEVICE, not per stock model (a model can't have "its"
// registers since two units of the same model may be wired differently, e.g. on-grid vs off-grid). Mapping registers now happens per device,
// during onboarding (variant selection clones the matching equipment_templates rows in) or later via that device's own "Edit Registers" page.
export default async function DevicesPage() {
  const supabase = await createClient();

  const [{ data: stockItems }, { data: inUse }] = await Promise.all([
    supabase.from("equipment_inventory").select(STOCK_COLUMNS).order("name"),
    // the pieces of equipment in use at a site (each points at the stock item it is)
    supabase.from("equipment").select("stock_id, site_id").not("stock_id", "is", null).is("retired_at", null),
  ]);

  const items = (stockItems ?? []) as unknown as StockRow[];
  const allocations: Allocation[] = (inUse ?? []).map((e) => ({ stock_id: e.stock_id as string, site_id: e.site_id }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every device model in inventory — specs, purchase details, and inventory tracking. What employees pick from during Site &amp; Device Setup.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/devices/catalog">
              <LibraryBig />
              Equipment Enum
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/devices/settings-history">
              <History />
              Settings History
            </Link>
          </Button>
        </div>
      </div>

      <StockOverview items={items} allocations={allocations} />

      <StockTable items={items} />
    </div>
  );
}
