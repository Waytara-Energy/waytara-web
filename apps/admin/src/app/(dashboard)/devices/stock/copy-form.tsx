import Link from "next/link";
import { Check } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryLabel, formatMoney, makeAndModel, type StockRow } from "../stock-types";
import { PoDocumentField } from "./po-document-field";
import { Field, StatusSelect } from "./stock-form";

function copiedLines(src: StockRow): string[] {
  const specs = src.technical_specs && typeof src.technical_specs === "object" ? Object.keys(src.technical_specs as object).length : 0;
  const warranty = src.warranty_info && typeof src.warranty_info === "object" ? (src.warranty_info as Record<string, unknown>) : null;
  const lines = [
    `Category: ${categoryLabel(src.category)}`,
    `Make and model: ${makeAndModel(src)}${src.model_number ? ` (${src.model_number})` : ""}`,
    src.power_capacity_value !== null ? `Power: ${src.power_capacity_value} ${src.power_capacity_unit ?? ""}`.trim() : null,
    src.phase_count ? `${src.phase_count === 3 ? "Three" : "Single"}-phase` : null,
    src.size_value !== null ? `Size: ${src.size_value} ${src.size_unit ?? ""}`.trim() : null,
    src.primary_uom ? `Counted in ${src.primary_uom}${src.pack_size ? ` (pack of ${src.pack_size})` : ""}` : null,
    src.unit_price !== null ? `Unit price: ${formatMoney(src.unit_price)}` : null,
    specs > 0 ? `${specs} technical ${specs === 1 ? "detail" : "details"}` : null,
    warranty ? `Warranty${typeof warranty.years === "number" ? `: ${warranty.years} ${warranty.years === 1 ? "year" : "years"}` : ""}` : null,
  ];
  return lines.filter((l): l is string => !!l);
}

/** The "copy an existing item" form: what the copy takes from the original (shown, not typed), and the few fields that are its own. */
export function CopyForm({ source, action }: { source: StockRow; action: (formData: FormData) => Promise<unknown> }) {
  const serialized = !!source.serial_number;
  return (
    <ActionForm action={action} loading="Copying…" success="The copy was added." className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Copied from {source.name}</CardTitle>
          <CardDescription>These come over as they are. Change them later on the new item&apos;s page if you need to.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {copiedLines(source).map((l) => (
              <li key={l} className="flex items-center gap-2 text-muted-foreground">
                <Check className="size-4 shrink-0 text-primary" />
                {l}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This copy</CardTitle>
          <CardDescription>Only what is different for this unit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" name="name" defaultValue={source.name} className="sm:col-span-2" hint="Keep the same name, or give the copy its own." />
          <Field
            label="Serial number"
            name="serialNumber"
            required={serialized}
            hint={serialized ? `Required: ${source.name} has a serial number, so each unit needs its own.` : "Optional: bulk items like cable don't have one."}
          />
          <Field label="Quantity" name="quantity" type="number" required defaultValue={1} />
          <StatusSelect />
          <Field label="Supplier" name="supplier" defaultValue={source.supplier} />
          <Field label="Purchase date" name="purchaseDate" type="date" />
          <Field label="PO reference" name="poReference" />
          <Field label="Purchase price (₹)" name="purchasePriceAmount" type="number" hint="What was paid for this purchase." />
          <PoDocumentField />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/devices">Cancel</Link>
        </Button>
        <FormSubmit pendingText="Copying…">Add the copy</FormSubmit>
      </div>
    </ActionForm>
  );
}
