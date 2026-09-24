import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { CatalogTable, type CatalogEntry, type EnumValueRow } from "./catalog-table";

// The shared instrument definitions device_parameter_map's per-model rows
// point at (see 20260924000100) — one catalog entry backs every vendor's
// register mapping for the same logical instrument, so this is the one
// place an admin edits what a key means, not per stock item.
export default async function InstrumentCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const [{ data: catalogRows }, { data: enumRows }] = await Promise.all([
    supabase
      .from("instrument_catalog")
      .select(
        "instrument_key, name, category, device_category, unit, description, value_kind, direction, min_role, regulated, cadence_seconds, enum_ref, valid_min, valid_max"
      )
      .order("device_category")
      .order("category")
      .order("instrument_key"),
    supabase.from("instrument_enum_values").select("enum_ref, code, label, notes").order("enum_ref").order("code"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Stock Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Instrument Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The shared instrument definitions every vendor&apos;s register map points at — name, unit, who can edit it, and
          whether it&apos;s a regulated grid-compliance setting. Editing one here changes it for every model that maps to it.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}
      {success && <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm text-primary">Saved.</div>}

      <CatalogTable items={(catalogRows ?? []) as CatalogEntry[]} enumValues={(enumRows ?? []) as EnumValueRow[]} />
    </div>
  );
}
