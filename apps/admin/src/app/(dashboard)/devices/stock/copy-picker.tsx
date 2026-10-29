"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { categoryLabel } from "../stock-types";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CopyChoice {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
}

/** Choose the item to copy. Choosing one reloads the page with that item (?from=), which shows what is copied and the few fields that are the copy's own. */
export function CopyPicker({ items, selected }: { items: CopyChoice[]; selected: string | null }) {
  const router = useRouter();
  const groups = new Map<string, CopyChoice[]>();
  for (const i of items) groups.set(i.category, [...(groups.get(i.category) ?? []), i]);

  return (
    <div className="grid max-w-xl gap-2">
      <Label>Item to copy</Label>
      <Select value={selected ?? undefined} onValueChange={(id) => router.push(`/devices/stock/new?from=${id}`)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose an existing item…" />
        </SelectTrigger>
        <SelectContent>
          {[...groups.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([category, list]) => (
              <SelectGroup key={category}>
                <SelectLabel>{categoryLabel(category)}</SelectLabel>
                {list.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                    {i.serial_number ? ` · ${i.serial_number}` : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Everything about the model is copied. You only enter what is different for this unit.</p>
    </div>
  );
}
