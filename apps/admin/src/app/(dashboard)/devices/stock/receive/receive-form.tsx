"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { receiveStock } from "../../actions";
import { categoryLabel } from "../../stock-types";
import { DocumentField } from "../document-field";

export interface ReceivableModel {
  id: string;
  name: string;
  category: string;
  tracking: string;
  primary_uom: string | null;
  detail: string;
}

/** Serial numbers typed or pasted: one per line, or separated by commas, semicolons or tabs (the same rule the server uses). */
function splitSerials(raw: string): string[] {
  return raw.split(/[\n\r,;\t]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * A delivery arrives. Pick the model; a serial-numbered model takes the serial numbers (paste the list, one per line), a lot model takes a quantity
 * and an optional lot id. The supplier, purchase order (reference and file), date, cost and shelf are recorded with it, and every unit is added
 * in one step: if any serial number is already in stock, nothing is added and it says which.
 */
export function ReceiveForm({ models, initialModel, today }: { models: ReceivableModel[]; initialModel: string | null; today: string }) {
  const router = useRouter();
  const [modelId, setModelId] = React.useState(initialModel ?? "");
  const [serials, setSerials] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const model = models.find((m) => m.id === modelId) ?? null;
  const serial = model?.tracking !== "lot";
  const list = React.useMemo(() => splitSerials(serials), [serials]);
  const repeated = React.useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const s of list) (seen.has(s.toLowerCase()) ? dupes : seen).add(s.toLowerCase());
    return [...dupes];
  }, [list]);

  const byCategory = React.useMemo(() => {
    const groups = new Map<string, ReceivableModel[]>();
    for (const m of models) groups.set(m.category, [...(groups.get(m.category) ?? []), m]);
    return [...groups.entries()].sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])));
  }, [models]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!model) return notify.error("Choose which model arrived.");
    if (serial && repeated.length > 0) return notify.error(`The list has ${repeated[0]} more than once.`);
    const formData = new FormData(e.currentTarget);
    formData.set("modelId", model.id);
    setBusy(true);
    const result = await receiveStock(formData);
    setBusy(false);
    if (!result.ok) return notify.error(result.error);
    notify.success(result.message ?? "Stock received.");
    router.push(`/devices/stock/${result.modelId ?? model.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>What arrived</CardTitle>
          <CardDescription>Choose the model, then list the units. A model has to be in the catalog first (Add a model).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label>Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a model" />
              </SelectTrigger>
              <SelectContent>
                {byCategory.map(([category, list]) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{categoryLabel(category)}</SelectLabel>
                    {list.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        <span className="ml-2 text-xs text-muted-foreground">{m.detail}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {model && serial ? (
            <div className="grid gap-2">
              <Label htmlFor="serials">Serial numbers</Label>
              <Textarea id="serials" name="serials" value={serials} onChange={(e) => setSerials(e.target.value)} rows={6} className="font-mono text-xs" placeholder={"One per line, e.g.\nDY-INV-2026-9813\nDY-INV-2026-9814"} />
              <p className={`text-xs ${repeated.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {repeated.length > 0
                  ? `${repeated[0]} is in the list more than once.`
                  : list.length > 0
                    ? `${list.length} ${list.length === 1 ? "unit" : "units"} to add. Paste a column from a spreadsheet, or scan them one after another.`
                    : "Each serial number becomes one unit. A serial number can only be in stock once."}
              </p>
            </div>
          ) : null}

          {model && !serial ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="quantity">
                  Quantity{model.primary_uom ? ` (${model.primary_uom})` : ""}
                  <span className="text-destructive"> *</span>
                </Label>
                <Input id="quantity" name="quantity" type="number" min={1} step={1} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lotId">Lot or batch number</Label>
                <Input id="lotId" name="lotId" placeholder="Leave empty to make one" />
                <p className="text-xs text-muted-foreground">The number on the pallet or box. Installations draw from the oldest lot first.</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The delivery</CardTitle>
          <CardDescription>Where it came from and what it cost. The purchase order is kept with this delivery.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Input id="supplier" name="supplier" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="poReference">PO reference</Label>
            <Input id="poReference" name="poReference" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receivedOn">Received on</Label>
            <Input id="receivedOn" name="receivedOn" type="date" defaultValue={today} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unitCost">Cost of each (₹)</Label>
            <Input id="unitCost" name="unitCost" type="number" min={0} step="any" />
            <p className="text-xs text-muted-foreground">What was paid for one {serial ? "unit" : model?.primary_uom ?? "piece"}.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Shelf or location</Label>
            <Input id="location" name="location" placeholder="e.g. Store room, shelf A2" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>
          <DocumentField slot="po" hint="The purchase order or delivery note, as a PDF or a photo. Up to 15 MB." />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={model ? `/devices/stock/${model.id}` : "/devices"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={busy || !model}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Receiving…" : serial && list.length > 0 ? `Receive ${list.length} ${list.length === 1 ? "unit" : "units"}` : "Receive stock"}
        </Button>
      </div>
    </form>
  );
}
