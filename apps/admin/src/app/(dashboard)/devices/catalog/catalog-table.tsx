"use client";

import * as React from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import {
  createCatalogEntry,
  updateCatalogEntry,
  deleteCatalogEntry,
  createEnumValue,
  updateEnumValue,
  deleteEnumValue,
} from "./actions";

export interface CatalogEntry {
  instrument_key: string;
  name: string;
  category: string;
  device_category: string;
  unit: string | null;
  description: string | null;
  value_kind: string;
  direction: string;
  min_role: string;
  regulated: boolean;
  cadence_seconds: number | null;
  enum_ref: string | null;
  valid_min: number | null;
  valid_max: number | null;
}

export interface EnumValueRow {
  enum_ref: string;
  code: string;
  label: string;
  notes: string | null;
}

const inputClass = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";
const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm";

function Field({
  label,
  name,
  type = "text",
  step,
  required,
  placeholder,
  defaultValue,
  readOnly,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className={inputClass}
      />
    </div>
  );
}

// Shared by the "add" and "edit" sheets — instrumentKey is only editable
// (and required) when creating a new row, since it's the primary key
// every device_parameter_map row references by value.
function CatalogFields({ defaults, keyEditable }: { defaults?: CatalogEntry; keyEditable: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Instrument key" name="instrumentKey" required={keyEditable} readOnly={!keyEditable} defaultValue={defaults?.instrument_key} />
      <Field label="Name" name="name" required defaultValue={defaults?.name} />
      <Field label="Category" name="category" required placeholder="solar, battery, generator…" defaultValue={defaults?.category} />
      <Field
        label="Device category"
        name="deviceCategory"
        required
        placeholder="solar_inverter, ev_charger…"
        defaultValue={defaults?.device_category}
      />
      <Field label="Unit" name="unit" placeholder="%, V, kWh…" defaultValue={defaults?.unit ?? ""} />
      <Field label="Cadence (s)" name="cadenceSeconds" type="number" placeholder="on-open" defaultValue={defaults?.cadence_seconds ?? ""} />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Value kind</label>
        <select name="valueKind" defaultValue={defaults?.value_kind ?? "numeric"} className={selectClass}>
          <option value="numeric">numeric</option>
          <option value="enum">enum</option>
          <option value="boolean">boolean</option>
          <option value="text">text</option>
          <option value="timestamp">timestamp</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Direction</label>
        <select name="direction" defaultValue={defaults?.direction ?? "read"} className={selectClass}>
          <option value="read">read</option>
          <option value="write">write</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Min role</label>
        <select name="minRole" defaultValue={defaults?.min_role ?? "customer"} className={selectClass}>
          <option value="customer">customer</option>
          <option value="employee">employee</option>
          <option value="site_engineer">site_engineer</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <label className="flex h-9 items-center gap-1.5 text-xs">
        <input type="checkbox" name="regulated" defaultChecked={defaults?.regulated} className="h-3.5 w-3.5" />
        Regulated (grid-compliance — confirm + audit before any write)
      </label>

      <Field label="Enum ref" name="enumRef" placeholder="only for value kind = enum" defaultValue={defaults?.enum_ref ?? ""} />
      <div />
      <Field label="Valid min" name="validMin" type="number" step="any" defaultValue={defaults?.valid_min ?? ""} />
      <Field label="Valid max" name="validMax" type="number" step="any" defaultValue={defaults?.valid_max ?? ""} />

      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">Description (shown to customers)</label>
        <textarea
          name="description"
          className="min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          placeholder="What this field controls, in plain language — not the decode formula."
          defaultValue={defaults?.description ?? ""}
        />
      </div>
    </div>
  );
}

function CatalogRow({ item }: { item: CatalogEntry }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(true)}>
        <TableCell>
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{item.instrument_key}</p>
        </TableCell>
        <TableCell className="text-muted-foreground">{item.device_category}</TableCell>
        <TableCell className="text-muted-foreground">{item.category}</TableCell>
        <TableCell className="text-muted-foreground">{item.direction}</TableCell>
        <TableCell className="text-muted-foreground">{item.min_role}</TableCell>
        <TableCell>{item.regulated && <Badge variant="destructive">Regulated</Badge>}</TableCell>
        <TableCell className="text-muted-foreground">{item.unit ?? "—"}</TableCell>
      </TableRow>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{item.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{item.instrument_key}</SheetDescription>
          </SheetHeader>
          <form action={updateCatalogEntry.bind(null, item.instrument_key)} className="mt-4 space-y-3">
            <CatalogFields defaults={item} keyEditable={false} />
            <Button type="submit" size="sm">
              Save
            </Button>
          </form>
          <form action={deleteCatalogEntry.bind(null, item.instrument_key)} className="mt-4 border-t border-border pt-4">
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
              Delete instrument
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Fails if any model&apos;s register mapping still points at this key.
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CatalogSection({ items }: { items: CatalogEntry[] }) {
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.instrument_key, item.name, item.category, item.device_category].some((f) => f.toLowerCase().includes(q))
    );
  }, [items, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search key, name, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 pl-8"
          />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {items.length} instruments
        </div>
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Add instrument
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add an instrument</SheetTitle>
              <SheetDescription>
                Defines what a key means, shared across every vendor&apos;s model — add each model&apos;s own register
                mapping from the Stock Catalog&apos;s Register Map editor.
              </SheetDescription>
            </SheetHeader>
            <form action={createCatalogEntry} className="mt-4 space-y-3">
              <CatalogFields keyEditable />
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
              <TableHead>Instrument</TableHead>
              <TableHead>Device category</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Dir.</TableHead>
              <TableHead>Min role</TableHead>
              <TableHead />
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No instruments match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => <CatalogRow key={item.instrument_key} item={item} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EnumGroup({ enumRef, values }: { enumRef: string; values: EnumValueRow[] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="font-mono text-xs font-medium text-foreground">{enumRef}</h3>
      <div className="mt-2 space-y-1.5">
        {values.map((v) => (
          <form
            key={v.code}
            action={updateEnumValue.bind(null, v.enum_ref, v.code)}
            className="flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1 hover:border-border"
          >
            <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{v.code}</span>
            <Input name="label" defaultValue={v.label} className="h-8 w-48 text-xs" />
            <Input name="notes" defaultValue={v.notes ?? ""} placeholder="notes" className="h-8 w-48 text-xs" />
            <Button type="submit" variant="outline" size="sm">
              Save
            </Button>
            <Button type="submit" formAction={deleteEnumValue.bind(null, v.enum_ref, v.code)} variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </form>
        ))}
      </div>
      <form action={createEnumValue} className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
        <input type="hidden" name="enumRef" value={enumRef} />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Code</label>
          <Input name="code" placeholder="0" className="h-8 w-20 text-xs" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Label</label>
          <Input name="label" placeholder="Standby" className="h-8 w-40 text-xs" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <Input name="notes" className="h-8 w-40 text-xs" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Add code
        </Button>
      </form>
    </div>
  );
}

function EnumSection({ enumValues }: { enumValues: EnumValueRow[] }) {
  const [newRef, setNewRef] = React.useState("");
  const grouped = React.useMemo(() => {
    const map = new Map<string, EnumValueRow[]>();
    for (const v of enumValues) {
      const list = map.get(v.enum_ref) ?? [];
      list.push(v);
      map.set(v.enum_ref, list);
    }
    return Array.from(map.entries());
  }, [enumValues]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map(([enumRef, values]) => (
          <EnumGroup key={enumRef} enumRef={enumRef} values={values} />
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">Start a new enum list</p>
        <form action={createEnumValue} className="mt-2 flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Enum ref</label>
            <Input
              name="enumRef"
              value={newRef}
              onChange={(e) => setNewRef(e.target.value)}
              placeholder="e.g. inverter_fault_code"
              className="h-8 w-48 text-xs"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">First code</label>
            <Input name="code" placeholder="0" className="h-8 w-20 text-xs" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <Input name="label" placeholder="Standby" className="h-8 w-40 text-xs" required />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Create
          </Button>
        </form>
      </div>
    </div>
  );
}

export function CatalogTable({ items, enumValues }: { items: CatalogEntry[]; enumValues: EnumValueRow[] }) {
  return (
    <div className="space-y-8">
      <CatalogSection items={items} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Enum Values</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Referenced by an instrument&apos;s <code className="font-mono">enum_ref</code> — the customer dashboard and this
          admin&apos;s own Register Map editor show these labels wherever an enum field is read or written.
        </p>
        <EnumSection enumValues={enumValues} />
      </div>
    </div>
  );
}
