"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { withPromiseToast } from "@waytara/ui/notify";
import { updateEquipmentMetric, cloneRegistersFromDevice, bulkUpdateRegisters } from "./actions";

export interface MetricRow {
  id: string;
  key_name: string;
  category: string;
  device_category: string;
  direction: string;
  address: { registers?: number[] } | null;
  decode: { scale?: number; signed?: boolean; offset?: number; bitmask?: string; combine?: string; low_word_register?: number } | null;
  enum_ref: string | null;
  valid_min: number | null;
  valid_max: number | null;
  cadence_seconds: number | null;
  show_for_user: boolean;
  is_verified: boolean;
  notes: string | null;
  equipment_templates: { display_name: string; unit: string | null; value_kind: string | null };
}

export interface OtherDeviceOption {
  id: string;
  label: string;
}

const inputClass = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs";
const selectClass = "h-8 rounded-md border border-border bg-background px-2 text-xs";

function formatAddress(row: MetricRow): string {
  if (!row.address?.registers?.length) return "—";
  return row.address.registers.join(",");
}

function RowEditSheet({ row, equipmentId, open, onOpenChange }: { row: MetricRow; equipmentId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  async function handleSave(formData: FormData) {
    const ok = await withPromiseToast(updateEquipmentMetric.bind(null, equipmentId, row.id), {
      loading: "Saving…",
      success: "Register saved.",
    })(formData);
    if (ok) onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{row.equipment_templates.display_name}</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {row.key_name} · {row.category} · {row.direction}
          </SheetDescription>
        </SheetHeader>
        <form action={handleSave} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Registers</label>
              <Input name="registers" placeholder="184 or 72,73" defaultValue={row.address?.registers?.join(",") ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Scale</label>
              <Input name="scale" type="number" step="any" placeholder="1" defaultValue={row.decode?.scale ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" title="value = raw x scale + offset">Offset</label>
              <Input name="offset" type="number" step="any" placeholder="-100" title="value = raw x scale + offset. Example: 0.1 C units where raw 1000 = 0 C -> scale 0.1, offset -100." defaultValue={row.decode?.offset ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Bitmask</label>
              <Input name="bitmask" placeholder="0x0C" defaultValue={row.decode?.bitmask ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Combine</label>
              <select name="combine" defaultValue={row.decode?.combine ?? ""} className={selectClass}>
                <option value="">—</option>
                <option value="low_high_word">low_high_word</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Low word register</label>
              <Input name="lowWordRegister" type="number" defaultValue={row.decode?.low_word_register ?? ""} className={inputClass} />
            </div>
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <input type="checkbox" name="signed" defaultChecked={row.decode?.signed ?? false} className="h-3.5 w-3.5" />
              Signed
            </label>
            <div />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Enum ref</label>
              <Input name="enumRef" defaultValue={row.enum_ref ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cadence (s)</label>
              <Input name="cadenceSeconds" type="number" defaultValue={row.cadence_seconds ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Valid min</label>
              <Input name="validMin" type="number" step="any" defaultValue={row.valid_min ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Valid max</label>
              <Input name="validMax" type="number" step="any" defaultValue={row.valid_max ?? ""} className={inputClass} />
            </div>
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <input type="checkbox" name="showForUser" defaultChecked={row.show_for_user} className="h-3.5 w-3.5" />
              Show to customer
            </label>
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <input type="checkbox" name="isVerified" defaultChecked={row.is_verified} className="h-3.5 w-3.5" />
              Verified
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              name="notes"
              defaultValue={row.notes ?? ""}
              className="min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CloneForm({ equipmentId, otherDevices }: { equipmentId: string; otherDevices: OtherDeviceOption[] }) {
  if (otherDevices.length === 0) return null;
  const cloneAction = withPromiseToast(cloneRegistersFromDevice.bind(null, equipmentId), {
    loading: "Cloning…",
    success: (summary) => summary,
  });
  return (
    <form
      action={async (formData: FormData) => {
        await cloneAction(formData);
      }}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
    >
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Clone register addresses from…</label>
        <select name="fromEquipmentId" defaultValue="" className={`${selectClass} w-64`} required>
          <option value="" disabled>
            Pick a source device
          </option>
          {otherDevices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" size="sm">
        Clone
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Only fills in this device&apos;s own still-empty rows by matching key — never overwrites a row that already has an
        address.
      </p>
    </form>
  );
}

function BulkPasteForm({ equipmentId }: { equipmentId: string }) {
  const bulkAction = withPromiseToast(bulkUpdateRegisters.bind(null, equipmentId), {
    loading: "Updating…",
    success: (summary) => summary,
  });
  return (
    <form
      action={async (formData: FormData) => {
        await bulkAction(formData);
      }}
      className="space-y-2 rounded-md border border-dashed border-border p-3"
    >
      <label className="text-xs font-medium text-muted-foreground">
        Bulk paste (one register per line): <code className="font-mono">key_name|registers|scale|offset|signed|bitmask|combine</code>
      </label>
      <textarea
        name="rows"
        className="min-h-24 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
        placeholder={"total_grid_import_kwh|78,80|0.1||||low_high_word\nbattery_soc_pct|184"}
      />
      <Button type="submit" variant="outline" size="sm">
        Update all
      </Button>
    </form>
  );
}

export function RegistersTable({ equipmentId, metrics, otherDevices }: { equipmentId: string; metrics: MetricRow[]; otherDevices: OtherDeviceOption[] }) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [selected, setSelected] = React.useState<MetricRow | null>(null);

  const categories = React.useMemo(() => Array.from(new Set(metrics.map((m) => m.category))).sort(), [metrics]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return metrics.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (!q) return true;
      return [m.key_name, m.equipment_templates.display_name].some((f) => f.toLowerCase().includes(q));
    });
  }, [metrics, search, category]);

  return (
    <div className="space-y-4">
      <CloneForm equipmentId={equipmentId} otherDevices={otherDevices} />
      <BulkPasteForm equipmentId={equipmentId} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search key or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-64 pl-8" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {metrics.length} fields
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Dir.</TableHead>
              <TableHead>Registers</TableHead>
              <TableHead>Show</TableHead>
              <TableHead>Verified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No fields match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                  <TableCell>
                    <p className="font-medium text-foreground">{m.equipment_templates.display_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{m.key_name}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.category}</TableCell>
                  <TableCell className="text-muted-foreground">{m.direction}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{formatAddress(m)}</TableCell>
                  <TableCell>
                    <Badge variant={m.show_for_user ? "default" : "secondary"}>{m.show_for_user ? "Shown" : "Hidden"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.is_verified ? "default" : "secondary"}>{m.is_verified ? "Verified" : "Unverified"}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected && <RowEditSheet row={selected} equipmentId={equipmentId} open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} />}
    </div>
  );
}
