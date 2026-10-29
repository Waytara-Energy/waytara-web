import Link from "next/link";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CategoryChoice } from "../stock-categories";
import { documentHref, documentOf, type DocSlot } from "@/lib/stock-documents";
import { STATUS_OPTIONS, statusLabel, type StockRow } from "../stock-types";
import { CategorySelect } from "./category-select";
import { DocumentField, type ExistingDocument } from "./document-field";
import { SpecsEditor, WarrantyEditor } from "./specs-editor";

/** The units a stock item can be counted in. An item that already has another one keeps it. */
const UOMS = ["piece", "meter", "pack", "box", "set", "kg"];

export function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  hint,
  list,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | null;
  hint?: string;
  list?: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue ?? ""} step={type === "number" ? "any" : undefined} list={list} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function UomSelect({ defaultValue }: { defaultValue?: string | null }) {
  const current = defaultValue ?? "piece";
  const options = UOMS.includes(current) ? UOMS : [...UOMS, current];
  return (
    <div className="grid gap-2">
      <Label>Counted in</Label>
      <Select name="primaryUom" defaultValue={current}>
        <SelectTrigger className="w-full capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((u) => (
            <SelectItem key={u} value={u} className="capitalize">
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StatusSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <div className="grid gap-2">
      <Label>Status</Label>
      <Select name="status" defaultValue={defaultValue ?? "in_stock"}>
        <SelectTrigger className="w-full capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {statusLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The file an existing item has in a slot, as the field shows it. */
export function existingDocument(item: StockRow | undefined, slot: DocSlot): ExistingDocument | null {
  const doc = item ? documentOf(item, slot) : null;
  return item && doc ? { name: doc.name, size: doc.size, viewHref: documentHref(item.id, slot), downloadHref: documentHref(item.id, slot, true) } : null;
}

/**
 * The form of one stock item. The essentials (what it is, how many, its price) are always in view; everything else is in sections that open on
 * demand: more about the item, the purchase, the technical details and the warranty (the last two as rows to fill, never as JSON). A section that
 * is closed still keeps its fields in the form, so closing one never wipes what it holds. The same form creates an item and edits one.
 */
export function StockForm({
  defaults,
  categories,
  action,
  loading,
  success,
  submitLabel,
  cancelHref,
}: {
  defaults?: StockRow;
  /** the categories in use, to choose from */
  categories: CategoryChoice[];
  action: (formData: FormData) => Promise<unknown>;
  loading: string;
  success: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const editing = !!defaults;
  return (
    <ActionForm action={action} loading={loading} success={success} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>The item</CardTitle>
          <CardDescription>{editing ? "What it is and how much there is." : "Only the name and the category are required; the rest can be filled in later."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" name="name" required defaultValue={defaults?.name} placeholder="e.g. Deye 8kW Hybrid Inverter" />
          <CategorySelect categories={categories} defaultValue={defaults?.category} />
          <Field label="Brand" name="brand" defaultValue={defaults?.brand} />
          <Field label="Model" name="model" defaultValue={defaults?.model} />
          <Field label="Serial number" name="serialNumber" defaultValue={defaults?.serial_number} hint="One physical unit has one serial number. Leave it empty for bulk items such as cable." />
          <StatusSelect defaultValue={defaults?.status} />
          <Field label="Quantity" name="quantity" type="number" defaultValue={defaults?.quantity ?? 1} />
          <UomSelect defaultValue={defaults?.primary_uom} />
          <Field label="Unit price (₹)" name="unitPrice" type="number" defaultValue={defaults?.unit_price} />
        </CardContent>
      </Card>

      <Card className="py-0">
        <Accordion type="multiple" defaultValue={editing ? ["more", "purchase", "documents", "specs", "warranty"] : []} className="px-6">
          <AccordionItem value="more">
            <AccordionTrigger className="text-base font-semibold">More about the item</AccordionTrigger>
            <AccordionContent forceMount className="grid gap-5 sm:grid-cols-2">
              <Field label="Manufacturer" name="manufacturer" defaultValue={defaults?.manufacturer} />
              <Field label="Model number" name="modelNumber" defaultValue={defaults?.model_number} />
              <Field label="Power capacity" name="powerCapacityValue" type="number" defaultValue={defaults?.power_capacity_value} />
              <Field label="Power unit" name="powerCapacityUnit" placeholder="kW" defaultValue={defaults?.power_capacity_unit} />
              <div className="grid gap-2 sm:col-span-2">
                <Label>Phase</Label>
                <Select name="phaseCount" defaultValue={defaults?.phase_count ? String(defaults.phase_count) : "none"}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="1">Single-phase (including split-phase 2-leg wiring: still one AC phase)</SelectItem>
                    <SelectItem value="3">Three-phase</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The electrical phase count, not the number of wires. It is only a label here.</p>
              </div>
              <Field label="Size" name="sizeValue" type="number" defaultValue={defaults?.size_value} />
              <Field label="Size unit" name="sizeUnit" placeholder="mm, sq mm…" defaultValue={defaults?.size_unit} />
              <Field label="Pack size" name="packSize" type="number" defaultValue={defaults?.pack_size} hint="How many pieces one pack holds." />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="purchase">
            <AccordionTrigger className="text-base font-semibold">Purchase and supplier</AccordionTrigger>
            <AccordionContent forceMount className="grid gap-5 sm:grid-cols-2">
              <Field label="Supplier" name="supplier" defaultValue={defaults?.supplier} />
              <Field label="PO reference" name="poReference" defaultValue={defaults?.po_reference} />
              <Field label="Purchase date" name="purchaseDate" type="date" defaultValue={defaults?.purchase_date} />
              <Field label="Purchase price (₹)" name="purchasePriceAmount" type="number" defaultValue={defaults?.purchase_price_amount} hint="What was paid for this purchase." />
              <DocumentField slot="po" existing={existingDocument(defaults, "po")} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="documents">
            <AccordionTrigger className="text-base font-semibold">Manual and data sheet</AccordionTrigger>
            <AccordionContent forceMount className="grid gap-5">
              <DocumentField slot="manual" existing={existingDocument(defaults, "manual")} />
              <DocumentField slot="datasheet" existing={existingDocument(defaults, "datasheet")} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="specs">
            <AccordionTrigger className="text-base font-semibold">Technical details</AccordionTrigger>
            <AccordionContent forceMount>
              <SpecsEditor name="technicalSpecs" initial={defaults?.technical_specs} category={defaults?.category ?? ""} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="warranty" className="border-b-0">
            <AccordionTrigger className="text-base font-semibold">Warranty</AccordionTrigger>
            <AccordionContent forceMount>
              <WarrantyEditor name="warrantyInfo" initial={defaults?.warranty_info} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <FormSubmit pendingText="Saving…">{submitLabel}</FormSubmit>
      </div>
    </ActionForm>
  );
}
