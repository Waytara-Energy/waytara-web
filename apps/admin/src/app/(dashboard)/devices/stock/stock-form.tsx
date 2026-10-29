import Link from "next/link";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_OPTIONS, statusLabel, type StockRow } from "../stock-types";

function jsonToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  hint,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | null;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue ?? ""} step={type === "number" ? "any" : undefined} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * The form of one stock item, in sections by what an admin is filling in: who it is, what it is physically, and what was bought and is on hand.
 * The same form creates an item and edits one (`defaults` is the item being edited).
 */
export function StockForm({
  defaults,
  action,
  loading,
  success,
  submitLabel,
  cancelHref,
}: {
  defaults?: StockRow;
  action: (formData: FormData) => Promise<unknown>;
  loading: string;
  success: string;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <ActionForm action={action} loading={loading} success={success} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>What the item is called and who made it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" name="name" required defaultValue={defaults?.name} />
          <Field label="Category" name="category" required placeholder="e.g. solar_inverter" defaultValue={defaults?.category} />
          <Field label="Brand" name="brand" defaultValue={defaults?.brand} />
          <Field label="Manufacturer" name="manufacturer" defaultValue={defaults?.manufacturer} />
          <Field label="Model" name="model" defaultValue={defaults?.model} />
          <Field label="Model number" name="modelNumber" defaultValue={defaults?.model_number} />
          <Field label="Serial number" name="serialNumber" defaultValue={defaults?.serial_number} />
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select name="status" defaultValue={defaults?.status ?? "in_stock"}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
          <CardDescription>Power, phase and physical size.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Power capacity" name="powerCapacityValue" type="number" defaultValue={defaults?.power_capacity_value} />
          <Field label="Power capacity unit" name="powerCapacityUnit" placeholder="kW" defaultValue={defaults?.power_capacity_unit} />
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
            <p className="text-xs text-muted-foreground">The electrical phase count, not the number of wires. It is only a label here; it doesn&apos;t change which registers the model reads or writes.</p>
          </div>
          <Field label="Size" name="sizeValue" type="number" defaultValue={defaults?.size_value} />
          <Field label="Size unit" name="sizeUnit" placeholder="mm, sq mm…" defaultValue={defaults?.size_unit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory and purchase</CardTitle>
          <CardDescription>How much is on hand, and what it cost.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Quantity" name="quantity" type="number" defaultValue={defaults?.quantity ?? 0} />
          <Field label="Unit of measure" name="primaryUom" placeholder="piece, meter, pack…" defaultValue={defaults?.primary_uom} />
          <Field label="Pack size" name="packSize" type="number" defaultValue={defaults?.pack_size} />
          <Field label="Supplier" name="supplier" defaultValue={defaults?.supplier} />
          <Field label="Unit price (₹)" name="unitPrice" type="number" defaultValue={defaults?.unit_price} />
          <Field label="Purchase price (₹)" name="purchasePriceAmount" type="number" defaultValue={defaults?.purchase_price_amount} />
          <Field label="Purchase date" name="purchaseDate" type="date" defaultValue={defaults?.purchase_date} />
          <Field label="PO reference" name="poReference" defaultValue={defaults?.po_reference} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical details</CardTitle>
          <CardDescription>Free-form JSON, because a wire&apos;s spec sheet looks nothing like an inverter&apos;s. Leave empty if there is nothing to record.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="technicalSpecs">Technical specs (JSON)</Label>
            <Textarea id="technicalSpecs" name="technicalSpecs" rows={6} className="font-mono text-xs" defaultValue={jsonToText(defaults?.technical_specs)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="warrantyInfo">Warranty info (JSON)</Label>
            <Textarea id="warrantyInfo" name="warrantyInfo" rows={4} className="font-mono text-xs" defaultValue={jsonToText(defaults?.warranty_info)} />
          </div>
        </CardContent>
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
