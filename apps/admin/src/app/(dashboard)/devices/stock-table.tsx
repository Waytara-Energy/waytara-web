"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { createStockItem, updateStockItem, addParameter, removeParameter } from "./actions";

export interface StockRow {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  model_number: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  status: string;
  power_capacity_value: number | null;
  power_capacity_unit: string | null;
  size_value: number | null;
  size_unit: string | null;
  technical_specs: unknown;
  warranty_info: unknown;
  quantity: number;
  pack_size: number | null;
  primary_uom: string | null;
  purchase_price_amount: number | null;
  unit_price: number | null;
  purchase_date: string | null;
  supplier: string | null;
  po_reference: string | null;
  device_parameters: {
    id: string;
    parameter_key: string;
    parameter_name: string;
    unit: string | null;
    category: string | null;
    direction: string;
    modbus_register: unknown;
    is_required: boolean;
    verified: boolean;
  }[];
}

export interface InstrumentCatalogEntry {
  instrument_key: string;
  name: string;
  category: string;
  direction: string;
}

// Instrument/register management only makes sense for the device kinds
// that actually report telemetry over Modbus — a cable, breaker, or
// mounting bracket has no registers to catalog. Matched loosely
// (case-insensitive substring) against `category` since that field is
// free text an admin types, not a fixed lookup.
function isMonitoredCategory(category: string): boolean {
  const c = category.toLowerCase();
  return c.includes("inverter") || c.includes("ev charger") || c.includes("ev_charger");
}

const STATUS_OPTIONS = ["in_stock", "allocated", "installed", "damaged", "returned"] as const;

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  in_stock: "secondary",
  allocated: "outline",
  installed: "default",
  damaged: "destructive",
  returned: "outline",
};

const inputClass = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";
const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm";
const textareaClass = "min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono";

function jsonToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

// The full edit/create form — 22 fields grouped by what an admin is
// actually filling in (identity, physical specs, purchase/inventory
// tracking). Lives inside a Sheet now rather than always rendered inline,
// so the table itself stays scannable.
function StockFields({ defaults }: { defaults?: StockRow }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Name" name="name" required defaultValue={defaults?.name} />
      <Field label="Category" name="category" required placeholder="e.g. Inverters" defaultValue={defaults?.category} />
      <Field label="Brand" name="brand" defaultValue={defaults?.brand ?? ""} />
      <Field label="Model" name="model" defaultValue={defaults?.model ?? ""} />
      <Field label="Model number" name="modelNumber" defaultValue={defaults?.model_number ?? ""} />
      <Field label="Manufacturer" name="manufacturer" defaultValue={defaults?.manufacturer ?? ""} />
      <Field label="Serial number" name="serialNumber" defaultValue={defaults?.serial_number ?? ""} />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <select name="status" defaultValue={defaults?.status ?? "in_stock"} className={inputClass}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <Field label="Power capacity" name="powerCapacityValue" type="number" defaultValue={defaults?.power_capacity_value ?? ""} />
      <Field label="Power capacity unit" name="powerCapacityUnit" placeholder="kW" defaultValue={defaults?.power_capacity_unit ?? ""} />
      <Field label="Size" name="sizeValue" type="number" defaultValue={defaults?.size_value ?? ""} />
      <Field label="Size unit" name="sizeUnit" placeholder="mm, sq mm…" defaultValue={defaults?.size_unit ?? ""} />

      <Field label="Quantity" name="quantity" type="number" defaultValue={defaults?.quantity ?? 0} />
      <Field label="Pack size" name="packSize" type="number" defaultValue={defaults?.pack_size ?? ""} />
      <Field label="Primary UOM" name="primaryUom" placeholder="piece, meter, box…" defaultValue={defaults?.primary_uom ?? ""} />
      <Field label="Supplier" name="supplier" defaultValue={defaults?.supplier ?? ""} />

      <Field label="Purchase price" name="purchasePriceAmount" type="number" defaultValue={defaults?.purchase_price_amount ?? ""} />
      <Field label="Unit price" name="unitPrice" type="number" defaultValue={defaults?.unit_price ?? ""} />
      <Field label="Purchase date" name="purchaseDate" type="date" defaultValue={defaults?.purchase_date ?? ""} />
      <Field label="PO reference" name="poReference" defaultValue={defaults?.po_reference ?? ""} />

      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">Technical specs (JSON)</label>
        <textarea name="technicalSpecs" className={textareaClass} defaultValue={jsonToText(defaults?.technical_specs)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">Warranty info (JSON)</label>
        <textarea name="warrantyInfo" className={textareaClass} defaultValue={jsonToText(defaults?.warranty_info)} />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} className={inputClass} />
    </div>
  );
}

// device_parameters.modbus_register is jsonb, e.g.
// {"scale":1,"signed":true,"registers":[175]} — shown as compact JSON
// rather than picked apart field-by-field, since its shape isn't fixed
// (some rows carry a "note" or "combine" key too).
function formatModbusRegister(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

// Register Map editor — the actual "onboard a new vendor/model" workflow.
// Typing an existing instrument_key (autocompleted from `instrumentCatalog`,
// shared across every stock item) skips the "New instrument" fields
// entirely: only this model's register mapping gets added, the shared
// catalog definition is never touched. Typing a key that doesn't match
// anything reveals those fields, so a genuinely new instrument gets defined
// once, here, then reusable by every future model.
function RegisterMappingForm({ stockId, instrumentCatalog }: { stockId: string; instrumentCatalog: InstrumentCatalogEntry[] }) {
  const [key, setKey] = React.useState("");
  const existing = instrumentCatalog.find((c) => c.instrument_key === key.trim());
  const isNewKey = key.trim().length > 0 && !existing;
  const datalistId = `instrument-keys-${stockId}`;

  return (
    <form action={addParameter.bind(null, stockId)} className="space-y-3 rounded-md border border-dashed border-border p-3">
      <datalist id={datalistId}>
        {instrumentCatalog.map((c) => (
          <option key={c.instrument_key} value={c.instrument_key}>
            {c.name}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Instrument key</label>
          <Input
            name="parameterKey"
            list={datalistId}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. battery_soc_pct"
            className="h-8 w-48 text-xs"
            required
          />
        </div>
        {existing && (
          <p className="pb-1.5 text-xs text-muted-foreground">
            Existing instrument ({existing.category}, {existing.direction}) — only the register mapping below is added.
          </p>
        )}
      </div>

      {isNewKey && (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <p className="w-full text-xs font-medium text-muted-foreground">New instrument definition</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input name="parameterName" placeholder="e.g. State of Charge" className="h-8 w-40 text-xs" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Unit</label>
            <Input name="unit" placeholder="%, V, kWh…" className="h-8 w-20 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Input name="category" placeholder="solar, battery…" className="h-8 w-28 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Value kind</label>
            <select name="valueKind" defaultValue="numeric" className={selectClass}>
              <option value="numeric">numeric</option>
              <option value="enum">enum</option>
              <option value="boolean">boolean</option>
              <option value="text">text</option>
              <option value="timestamp">timestamp</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Direction</label>
            <select name="direction" defaultValue="read" className={selectClass}>
              <option value="read">read</option>
              <option value="write">write</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Min role</label>
            <select name="minRole" defaultValue="customer" className={selectClass}>
              <option value="customer">customer</option>
              <option value="employee">employee</option>
              <option value="site_engineer">site_engineer</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cadence (s)</label>
            <Input name="cadenceSeconds" type="number" placeholder="on-open" className="h-8 w-20 text-xs" />
          </div>
          <label className="flex h-8 items-center gap-1.5 text-xs">
            <input type="checkbox" name="regulated" className="h-3.5 w-3.5" />
            Regulated
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <p className="w-full text-xs font-medium text-muted-foreground">Register mapping (this model)</p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Protocol</label>
          <Input name="protocol" defaultValue="modbus_tcp" className="h-8 w-28 text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Registers</label>
          <Input name="registers" placeholder="184 or 72,73" className="h-8 w-24 text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Scale</label>
          <Input name="scale" type="number" step="any" placeholder="1" className="h-8 w-16 text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Offset</label>
          <Input name="offset" type="number" step="any" placeholder="-1000" className="h-8 w-20 text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Bitmask</label>
          <Input name="bitmask" placeholder="0x0C" className="h-8 w-20 text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Combine</label>
          <select name="combine" defaultValue="" className={selectClass}>
            <option value="">—</option>
            <option value="low_high_word">low_high_word</option>
          </select>
        </div>
        <label className="flex h-8 items-center gap-1.5 text-xs">
          <input type="checkbox" name="signed" className="h-3.5 w-3.5" />
          Signed
        </label>
        <label className="flex h-8 items-center gap-1.5 text-xs">
          <input type="checkbox" name="isRequired" className="h-3.5 w-3.5" />
          Required
        </label>
        <label className="flex h-8 items-center gap-1.5 text-xs">
          <input type="checkbox" name="verified" className="h-3.5 w-3.5" />
          Verified
        </label>
        <Button type="submit" variant="outline" size="sm">
          Add
        </Button>
      </div>
    </form>
  );
}

// Only device kinds that actually report telemetry (see
// isMonitoredCategory) get parameter/register management at all — a
// cable or breaker's detail sheet just skips this section entirely.
function ParametersSection({ item, instrumentCatalog }: { item: StockRow; instrumentCatalog: InstrumentCatalogEntry[] }) {
  if (!isMonitoredCategory(item.category)) return null;

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <h3 className="text-xs font-medium text-muted-foreground">Parameters ({item.device_parameters.length})</h3>
      {item.device_parameters.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Dir.</TableHead>
                <TableHead>Modbus register</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.device_parameters.map((parameter) => (
                <TableRow key={parameter.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{parameter.parameter_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{parameter.parameter_key}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{parameter.unit ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{parameter.category ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{parameter.direction}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatModbusRegister(parameter.modbus_register)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={parameter.is_required ? "default" : "secondary"}>
                      {parameter.is_required ? "Required" : "Optional"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={parameter.verified ? "default" : "secondary"}>
                      {parameter.verified ? "Verified" : "Unverified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <form action={removeParameter.bind(null, parameter.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RegisterMappingForm stockId={item.id} instrumentCatalog={instrumentCatalog} />
    </div>
  );
}

// Row-click detail: full spec/purchase info + the edit form + instrument
// catalog, all in one Sheet — keeps the table itself down to the handful
// of columns someone scanning inventory actually needs at a glance.
function DetailSheet({
  item,
  open,
  onOpenChange,
  instrumentCatalog,
}: {
  item: StockRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrumentCatalog: InstrumentCatalogEntry[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>{item.name}</SheetTitle>
              <SheetDescription>
                {item.category}
                {item.brand ? ` · ${item.brand}` : ""}
                {item.model ? ` ${item.model}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
              <SummaryStat label="Quantity" value={`${item.quantity}${item.primary_uom ? ` ${item.primary_uom}` : ""}`} />
              <SummaryStat label="Unit price" value={formatMoney(item.unit_price)} />
              <SummaryStat label="Purchase price" value={formatMoney(item.purchase_price_amount)} />
              <SummaryStat label="Status" value={item.status.replace(/_/g, " ")} />
            </div>

            <form action={updateStockItem.bind(null, item.id)} className="mt-6 space-y-3">
              <StockFields defaults={item} />
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>

            <ParametersSection item={item} instrumentCatalog={instrumentCatalog} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium capitalize text-foreground">{value}</p>
    </div>
  );
}

export function StockTable({ items, instrumentCatalog }: { items: StockRow[]; instrumentCatalog: InstrumentCatalogEntry[] }) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState<StockRow | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const categories = React.useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return [item.name, item.brand, item.model, item.model_number, item.manufacturer, item.serial_number]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    });
  }, [items, search, category, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, brand, model, serial…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 pl-8"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {items.length} items
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Add stock item
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add a stock item</SheetTitle>
              <SheetDescription>Creates a new catalog/inventory row.</SheetDescription>
            </SheetHeader>
            <form action={createStockItem} className="mt-4 space-y-3">
              <StockFields />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand / Manufacturer</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No stock items match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelected(item)}>
                  <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.brand || item.manufacturer || "—"}
                    {item.model ? ` ${item.model}` : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.quantity}
                    {item.primary_uom ? ` ${item.primary_uom}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"} className="capitalize">
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DetailSheet
        item={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        instrumentCatalog={instrumentCatalog}
      />
    </div>
  );
}
