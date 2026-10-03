import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { CatalogTable, type EnumValueRow } from "./catalog-table";

// The centralized, admin/employee-extensible enum library — a group
// (enum_ref) of code/label pairs any equipment_metrics row (any device,
// any customer) can reuse via that row's own enum_ref. Instrument
// definitions themselves live in equipment_templates now (seeded from the
// label workbooks, not hand-edited here) — this page is purely the enum
// side, which genuinely is meant to grow ad hoc as new devices are onboarded.
export default async function EquipmentEnumPage() {
  const supabase = await createClient();

  const { data: enumRows } = await supabase.from("equipment_enum").select("enum_ref, code, label, notes").order("enum_ref").order("code");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Stock Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Equipment Enum</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Centralized code/label lists — attach a group to any device&apos;s field via that field&apos;s own enum_ref on
          the device&apos;s Edit Registers page. Reusable across every device and customer.
        </p>
      </div>

      <CatalogTable enumValues={(enumRows ?? []) as EnumValueRow[]} />
    </div>
  );
}
