import Link from "next/link";
import { LibraryBig } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@waytara/ui/button";
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

  // device_parameters is retired — its old flat shape (parameter_key,
  // parameter_name, unit, category, modbus_register, is_required) is now
  // split across instrument_catalog (the shared definition, joined here)
  // and device_parameter_map (the per-model row, `stock`'s real child now).
  // Reassembled into that exact same flat shape below so stock-table.tsx's
  // existing table display needs no changes — plus verified/direction,
  // new columns the Register Map editor needs that device_parameters never had.
  const [{ data: stockItemsRaw }, { data: catalogRows }] = await Promise.all([
    supabase
      .from("stock")
      .select(
        "id, name, category, brand, model, model_number, manufacturer, serial_number, status, power_capacity_value, power_capacity_unit, size_value, size_unit, technical_specs, warranty_info, quantity, pack_size, primary_uom, purchase_price_amount, unit_price, purchase_date, supplier, po_reference, device_parameter_map(id, instrument_key, is_required, verified, address, decode, instrument_catalog(name, category, unit, direction))"
      )
      .order("name"),
    // The full shared catalog, for the Register Map editor's "reuse an
    // existing key" autocomplete — an admin onboarding a second vendor
    // types an existing key here instead of ever recreating it.
    supabase.from("instrument_catalog").select("instrument_key, name, category, direction").order("instrument_key"),
  ]);

  const instrumentCatalog = catalogRows ?? [];

  const stockItems = (stockItemsRaw ?? []).map((item) => {
    const { device_parameter_map, ...rest } = item;
    return {
      ...rest,
      device_parameters: (device_parameter_map ?? []).map((m) => ({
        id: m.id,
        parameter_key: m.instrument_key,
        parameter_name: m.instrument_catalog?.name ?? m.instrument_key,
        unit: m.instrument_catalog?.unit ?? null,
        category: m.instrument_catalog?.category ?? null,
        direction: m.instrument_catalog?.direction ?? "read",
        modbus_register: { ...(m.address as object), ...((m.decode as object) ?? {}) },
        is_required: m.is_required,
        verified: m.verified,
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every device model in inventory — specs, purchase details, and the instruments each one reports. What
            employees pick from during Site &amp; Device Setup, and what customers see readings for.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/devices/catalog">
            <LibraryBig className="size-4" />
            Instrument Catalog
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm text-primary">Saved.</div>
      )}

      <StockTable items={(stockItems ?? []) as StockRow[]} instrumentCatalog={instrumentCatalog} />
    </div>
  );
}
