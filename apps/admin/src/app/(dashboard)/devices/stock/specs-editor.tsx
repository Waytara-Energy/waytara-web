"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  duplicateNames,
  labelFromKey,
  objectFromRows,
  rowsFromObject,
  specSuggestions,
  toKey,
  WARRANTY_FIELD_KEYS,
  WARRANTY_SUGGESTIONS,
  WARRANTY_TYPES,
  type SpecRow,
} from "./spec-format";

/** Rows of a name and a value, with a button to add one, one-click suggestions, and a remove button on each. The form keeps what is typed as JSON in a hidden field; the admin never sees it. */
function Rows({
  rows,
  setRows,
  nextId,
  suggestions,
  addLabel,
  emptyText,
  namePlaceholder,
  valuePlaceholder,
}: {
  rows: SpecRow[];
  setRows: React.Dispatch<React.SetStateAction<SpecRow[]>>;
  nextId: React.MutableRefObject<number>;
  suggestions: string[];
  addLabel: string;
  emptyText: string;
  namePlaceholder: string;
  valuePlaceholder: string;
}) {
  const used = new Set(rows.map((r) => toKey(r.name)));
  const offered = suggestions.filter((k) => !used.has(k));
  const dups = duplicateNames(rows);

  function add(name = "") {
    setRows((rs) => [...rs, { id: nextId.current++, name, value: "" }]);
  }
  function change(id: number, patch: Partial<SpecRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="grid gap-3">
      {rows.length === 0 ? <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">{emptyText}</p> : null}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-start gap-2">
          <Input aria-label="Name" value={r.name} onChange={(e) => change(r.id, { name: e.target.value })} placeholder={namePlaceholder} />
          {r.value.length > 70 || r.value.includes("\n") ? (
            <Textarea aria-label="Value" value={r.value} onChange={(e) => change(r.id, { value: e.target.value })} rows={3} placeholder={valuePlaceholder} />
          ) : (
            <Input aria-label="Value" value={r.value} onChange={(e) => change(r.id, { value: e.target.value })} placeholder={valuePlaceholder} />
          )}
          <Button type="button" variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} title="Remove this row">
            <Trash2 />
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      ))}
      {dups.length > 0 ? <p className="text-xs text-destructive">{dups.join(", ")} {dups.length === 1 ? "appears" : "appear"} more than once: only the last one is kept.</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add()}>
          <Plus />
          {addLabel}
        </Button>
        {offered.length > 0 ? <span className="text-xs text-muted-foreground">Quick add:</span> : null}
        {offered.map((k) => (
          <Button key={k} type="button" variant="secondary" size="xs" onClick={() => add(labelFromKey(k))}>
            <Plus />
            {labelFromKey(k)}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The technical details of an item: a list of specifications (name and value). */
export function SpecsEditor({ name, initial, category }: { name: string; initial: unknown; category: string }) {
  const [rows, setRows] = React.useState<SpecRow[]>(() => rowsFromObject(initial));
  const nextId = React.useRef(rows.length + 1);
  const stored = objectFromRows(rows);
  return (
    <div>
      <input type="hidden" name={name} value={Object.keys(stored).length ? JSON.stringify(stored) : ""} />
      <Rows
        rows={rows}
        setRows={setRows}
        nextId={nextId}
        suggestions={specSuggestions(category)}
        addLabel="Add a specification"
        emptyText="No specifications yet. Add what the datasheet lists, like power, voltage or IP rating."
        namePlaceholder="e.g. IP rating"
        valuePlaceholder="e.g. IP65"
      />
    </div>
  );
}

/** The warranty of an item: the years, the kind and who gives it, and any other terms as rows. */
export function WarrantyEditor({ name, initial }: { name: string; initial: unknown }) {
  const obj = initial && typeof initial === "object" && !Array.isArray(initial) ? (initial as Record<string, unknown>) : {};
  const [years, setYears] = React.useState(obj.years === undefined || obj.years === null ? "" : String(obj.years));
  const [type, setType] = React.useState(typeof obj.type === "string" && obj.type ? obj.type : "none");
  const [provider, setProvider] = React.useState(typeof obj.provider === "string" ? obj.provider : "");
  const [rows, setRows] = React.useState<SpecRow[]>(() => rowsFromObject(initial, 1, WARRANTY_FIELD_KEYS));
  const nextId = React.useRef(rows.length + 1);

  const types = WARRANTY_TYPES.some((t) => t.value === type) || type === "none" ? WARRANTY_TYPES : [...WARRANTY_TYPES, { value: type, label: labelFromKey(type) }];

  const stored: Record<string, unknown> = {};
  const y = Number(years);
  if (years.trim() && Number.isFinite(y)) stored.years = y;
  if (type !== "none") stored.type = type;
  if (provider.trim()) stored.provider = provider.trim();
  Object.assign(stored, objectFromRows(rows));

  return (
    <div className="grid gap-5">
      <input type="hidden" name={name} value={Object.keys(stored).length ? JSON.stringify(stored) : ""} />
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={`${name}-years`}>Warranty (years)</Label>
          <Input id={`${name}-years`} type="number" min={0} step="any" value={years} onChange={(e) => setYears(e.target.value)} placeholder="e.g. 5" />
        </div>
        <div className="grid gap-2">
          <Label>Kind of warranty</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${name}-provider`}>Given by</Label>
          <Input id={`${name}-provider`} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. the manufacturer" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Other warranty terms</Label>
        <Rows
          rows={rows}
          setRows={setRows}
          nextId={nextId}
          suggestions={WARRANTY_SUGGESTIONS}
          addLabel="Add a warranty term"
          emptyText="Nothing else. Add terms like a performance warranty or a cycle life if the item has them."
          namePlaceholder="e.g. Performance (years)"
          valuePlaceholder="e.g. 30"
        />
      </div>
    </div>
  );
}
