"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * A list of short texts to add to and remove from, one row each (for covered items, extras...). The form receives it as JSON text in a field called
 * `name`, so nobody types JSON by hand.
 */
export function StringListEditor({ name, initial, placeholder, addLabel = "Add" }: { name: string; initial?: unknown; placeholder?: string; addLabel?: string }) {
  const [items, setItems] = React.useState<string[]>(() => (Array.isArray(initial) ? initial.filter((v): v is string => typeof v === "string") : []));
  const json = JSON.stringify(items.map((s) => s.trim()).filter(Boolean));

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={json === "[]" ? "" : json} />
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={item} onChange={(e) => setItems((l) => l.map((v, j) => (j === i ? e.target.value : v)))} placeholder={placeholder} aria-label={`${addLabel} ${i + 1}`} />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} title="Remove">
            <X />
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setItems((l) => [...l, ""])}>
          <Plus />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
