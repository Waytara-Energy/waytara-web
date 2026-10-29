import Link from "next/link";
import { LibraryBig, History } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@/components/ui/button";
import { StockOverview, type ModelStock } from "./stock-overview";
import { StockTable } from "./stock-table";
import { STOCK_COLUMNS, summarizeUnits, type StockRow } from "./stock-types";

// Admin-only route (enforced in middleware.ts). The stock: `equipment_inventory` is the catalog of MODELS (brand, specs, warranty, manual, data sheet),
// and `stock_units` is the real stock under each model, one row per serial number or per lot. The cards above the table are the overview (what is
// available, reserved and installed, what needs reordering, what it is worth); a row opens that model's own page (/devices/stock/[id]) with its units.
//
// Registers no longer live here at all — equipment_metrics scopes them per physical DEVICE, not per stock model (a model can't have "its"
// registers since two units of the same model may be wired differently, e.g. on-grid vs off-grid). Mapping registers now happens per device,
// during onboarding (variant selection clones the matching equipment_templates rows in) or later via that device's own "Edit Registers" page.
export default async function DevicesPage() {
  const supabase = await createClient();

  const [{ data: modelRows }, { data: unitRows }] = await Promise.all([
    supabase.from("equipment_inventory").select(STOCK_COLUMNS).order("name"),
    supabase.from("stock_units").select("model_id, status, quantity, remaining"),
  ]);

  const unitsByModel = new Map<string, { status: string; quantity: number; remaining: number }[]>();
  const statusCounts: Record<string, number> = {};
  for (const u of unitRows ?? []) {
    unitsByModel.set(u.model_id, [...(unitsByModel.get(u.model_id) ?? []), u]);
    statusCounts[u.status] = (statusCounts[u.status] ?? 0) + 1;
  }
  const rows: ModelStock[] = ((modelRows ?? []) as unknown as StockRow[]).map((model) => ({ model, sum: summarizeUnits(unitsByModel.get(model.id) ?? []) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every model you stock, and the units under it. Receive a delivery, reserve a unit for a customer, and install it during Site &amp; Device Setup.
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

      <StockOverview rows={rows} statusCounts={statusCounts} />

      <StockTable rows={rows} />
    </div>
  );
}
