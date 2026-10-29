import Link from "next/link";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentHref, documentOf, type DocSlot } from "@/lib/stock-documents";
import type { CategoryChoice } from "../stock-categories";
import type { StockRow } from "../stock-types";
import { CategorySelect } from "./category-select";
import { DocumentField, type ExistingDocument } from "./document-field";
import { SpecsEditor, WarrantyEditor } from "./specs-editor";

/** The units a model's stock can be counted in. A model that already has another one keeps it. */
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

/** How a model's stock is counted: by serial number (every unit has its own) or by lot (a batch with an id and a quantity). Fixed once there is stock. */
function TrackingSelect({ defaultValue, locked }: { defaultValue: string; locked: boolean }) {
  return (
    <div className="grid gap-2">
      <Label>How stock is counted</Label>
      {locked ? <input type="hidden" name="tracking" value={defaultValue} /> : null}
      <Select name={locked ? undefined : "tracking"} defaultValue={defaultValue} disabled={locked}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="serial">By serial number (every unit has its own)</SelectItem>
          <SelectItem value="lot">By lot (a batch with a quantity)</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {locked ? "This model already has stock, so this can't change." : "Inverters, chargers, batteries, meters and hubs have serial numbers; panels, cable and breakers come in lots."}
      </p>
    </div>
  );
}

/** The file an existing model has in a slot, as the field shows it. */
export function existingDocument(item: StockRow | undefined, slot: DocSlot): ExistingDocument | null {
  const doc = item ? documentOf(item, slot) : null;
  return item && doc ? { name: doc.name, size: doc.size, viewHref: documentHref(item.id, slot), downloadHref: documentHref(item.id, slot, true) } : null;
}

/**
 * The form of one MODEL (what the product is): its name and category, how its stock is counted, then sections that open on demand: more about it, its
 * manual and data sheet, its technical details and its warranty (the last two as rows to fill, never as JSON). A section that is closed still keeps its
 * fields in the form. Stock itself (serial numbers, quantities, purchases) is never typed here: it is received, see the Receive stock page. The same
 * form creates a model and edits one.
 */
export function StockForm({
  defaults,
  categories,
  action,
  loading,
  success,
  submitLabel,
  cancelHref,
  hasStock = false,
}: {
  defaults?: StockRow;
  /** the categories in use, to choose from */
  categories: CategoryChoice[];
  action: (formData: FormData) => Promise<unknown>;
  loading: string;
  success: string;
  submitLabel: string;
  cancelHref: string;
  /** the model already has units: how it is counted is then fixed */
  hasStock?: boolean;
}) {
  const editing = !!defaults;
  return (
    <ActionForm action={action} loading={loading} success={success} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>The model</CardTitle>
          <CardDescription>{editing ? "What the product is." : "What the product is. You add its stock afterwards, by receiving it."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" name="name" required defaultValue={defaults?.name} placeholder="e.g. Deye 8kW Hybrid Inverter" />
          <CategorySelect categories={categories} defaultValue={defaults?.category} />
          <Field label="Brand" name="brand" defaultValue={defaults?.brand} />
          <Field label="Model" name="model" defaultValue={defaults?.model} />
          <TrackingSelect defaultValue={defaults?.tracking ?? "serial"} locked={hasStock} />
          <UomSelect defaultValue={defaults?.primary_uom} />
          <Field label="Unit price (₹)" name="unitPrice" type="number" defaultValue={defaults?.unit_price} hint="What one costs when sold or quoted." />
          <Field label="Reorder level" name="reorderLevel" type="number" defaultValue={defaults?.reorder_level ?? 0} hint="Flagged as low when this many or fewer are in stock. 0 means no warning." />
        </CardContent>
      </Card>

      <Card className="py-0">
        <Accordion type="multiple" defaultValue={editing ? ["more", "documents", "specs", "warranty"] : []} className="px-6">
          <AccordionItem value="more">
            <AccordionTrigger className="text-base font-semibold">More about the model</AccordionTrigger>
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
