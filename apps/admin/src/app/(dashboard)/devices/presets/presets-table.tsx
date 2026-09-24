"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { createPreset, updatePreset, deletePreset, previewPresetForDevice, type PresetPreviewRow } from "./actions";
import type { Json } from "@waytara/supabase";

export interface PresetRow {
  key: string;
  name: string;
  description: string;
  device_category: string;
  values: Record<string, Json>;
  is_active: boolean;
}

export interface SampleDevice {
  id: string;
  label: string;
  category: string;
}

const inputClass = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";
const textareaClass = "min-h-40 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono";

// Parsed client-side purely for the "resolves to" preview below the JSON
// textarea — bad JSON while typing just means an empty preview, never an
// error thrown at the admin mid-edit.
function tryParseValues(raw: string): Record<string, Json> | null {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function DevicePreview({ presetKey, devices }: { presetKey: string; devices: SampleDevice[] }) {
  const [deviceId, setDeviceId] = React.useState("");
  const [rows, setRows] = React.useState<PresetPreviewRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function preview() {
    if (!deviceId) return;
    startTransition(async () => {
      const result = await previewPresetForDevice(deviceId, presetKey);
      if ("error" in result) {
        setError(result.error);
        setRows(null);
      } else {
        setError(null);
        setRows(result.rows);
      }
    });
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Preview against a sample device</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={inputClass + " max-w-64"}>
          <option value="">Select a device…</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" disabled={!deviceId || pending} onClick={preview}>
          {pending ? "Loading…" : "Preview"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {rows && (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Current value</TableHead>
                <TableHead>Preset would set</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-4 text-center text-xs text-muted-foreground">
                    Nothing in this preset's values.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <p className="text-foreground">{r.catalogName ?? r.key}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.key}
                        {r.unit ? ` (${r.unit})` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.currentValue ?? "— never set —"}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.presetValue}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ValuesEditor({ defaultValue }: { defaultValue: string }) {
  const [text, setText] = React.useState(defaultValue);
  const parsed = tryParseValues(text);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Values ({"{instrument_key: value}"} JSON)</label>
      <textarea name="values" value={text} onChange={(e) => setText(e.target.value)} className={textareaClass} required />
      {text.trim() && (
        <p className="text-xs text-muted-foreground">
          {parsed ? `Resolves to ${Object.keys(parsed).length} key(s).` : "Not valid JSON yet."}
        </p>
      )}
    </div>
  );
}

function PresetFields({ defaults, keyEditable }: { defaults?: PresetRow; keyEditable: boolean }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Key</label>
          <Input name="key" required={keyEditable} readOnly={!keyEditable} defaultValue={defaults?.key} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input name="name" required defaultValue={defaults?.name} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Device category</label>
          <Input name="deviceCategory" required placeholder="solar_inverter, ev_charger…" defaultValue={defaults?.device_category} className={inputClass} />
        </div>
        <label className="flex h-9 items-center gap-1.5 text-xs">
          <input type="checkbox" name="isActive" defaultChecked={defaults?.is_active ?? true} className="h-3.5 w-3.5" />
          Active (visible to customers)
        </label>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description (shown to customers)</label>
        <textarea
          name="description"
          required
          className="min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          defaultValue={defaults?.description}
        />
      </div>
      <ValuesEditor defaultValue={defaults ? JSON.stringify(defaults.values, null, 2) : ""} />
    </div>
  );
}

function PresetRowItem({ item, devices }: { item: PresetRow; devices: SampleDevice[] }) {
  const [open, setOpen] = React.useState(false);
  const matchingDevices = devices.filter((d) => d.category === item.device_category);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(true)}>
        <TableCell>
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{item.key}</p>
        </TableCell>
        <TableCell className="text-muted-foreground">{item.device_category}</TableCell>
        <TableCell className="text-muted-foreground">{Object.keys(item.values).length} keys</TableCell>
        <TableCell>
          <Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Active" : "Inactive"}</Badge>
        </TableCell>
      </TableRow>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{item.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{item.key}</SheetDescription>
          </SheetHeader>
          <form action={updatePreset.bind(null, item.key)} className="mt-4 space-y-3">
            <PresetFields defaults={item} keyEditable={false} />
            <Button type="submit" size="sm">
              Save
            </Button>
          </form>

          <DevicePreview presetKey={item.key} devices={matchingDevices} />

          <form action={deletePreset.bind(null, item.key)} className="mt-4 border-t border-border pt-4">
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
              Delete preset
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">Fails if any device has ever had this preset applied.</p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function PresetsTable({ presets, devices }: { presets: PresetRow[]; devices: SampleDevice[] }) {
  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Add preset
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Add a setting preset</SheetTitle>
              <SheetDescription>A named bundle of writes the customer dashboard can offer as a template.</SheetDescription>
            </SheetHeader>
            <form action={createPreset} className="mt-4 space-y-3">
              <PresetFields keyEditable />
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
              <TableHead>Preset</TableHead>
              <TableHead>Device category</TableHead>
              <TableHead>Values</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No presets yet.
                </TableCell>
              </TableRow>
            ) : (
              presets.map((p) => <PresetRowItem key={p.key} item={p} devices={devices} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
