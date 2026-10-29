"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { addStockCategory, removeStockCategory } from "../actions";
import type { CategoryChoice } from "../stock-categories";
import { categoryLabel, PROTECTED_CATEGORIES } from "../stock-types";

/**
 * The category of a stock item: open the list, type to search it, pick one. When what was typed is not in the list, the first line offers to add it
 * as a new category, right there (it is saved to the list at once). An X at the end of a line removes a category nobody uses; the two the system
 * depends on have none, and a category with models says how many instead of going. The form receives the chosen name as `category`.
 */
export function CategorySelect({ categories, defaultValue }: { categories: CategoryChoice[]; defaultValue?: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [value, setValue] = React.useState(defaultValue ?? "");
  const [added, setAdded] = React.useState<string[]>([]);
  const [removed, setRemoved] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  const options = React.useMemo(() => {
    const byName = new Map<string, number>(categories.map((c) => [c.name, c.items]));
    for (const a of added) if (!byName.has(a)) byName.set(a, 0);
    if (defaultValue && !byName.has(defaultValue)) byName.set(defaultValue, 1);
    return [...byName]
      .filter(([name]) => !removed.includes(name))
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => categoryLabel(a.name).localeCompare(categoryLabel(b.name)));
  }, [categories, added, removed, defaultValue]);

  const typed = query.trim();
  const q = typed.toLowerCase();
  const shown = q ? options.filter((c) => categoryLabel(c.name).toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : options;
  const exists = options.some((c) => c.name.toLowerCase() === q || categoryLabel(c.name).toLowerCase() === q);

  function choose(next: string) {
    setValue(next);
    setOpen(false);
    setQuery("");
  }

  async function add() {
    setBusy(true);
    const result = await addStockCategory(typed);
    setBusy(false);
    if (!result.ok) return notify.error(result.error);
    setAdded((a) => [...a, result.name]);
    choose(result.name);
  }

  async function remove(name: string) {
    setBusy(true);
    const result = await removeStockCategory(name);
    setBusy(false);
    if (!result.ok) return notify.error(result.error);
    setRemoved((r) => [...r, name]);
    if (value === name) setValue("");
    notify.success(`${categoryLabel(name)} removed.`);
  }

  return (
    <div className="grid gap-2">
      <Label>
        Category<span className="text-destructive"> *</span>
      </Label>
      <input type="hidden" name="category" value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? categoryLabel(value) : "Choose a category"}</span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder="Search, or type a new category…" />
            <CommandList>
              {typed && !exists ? (
                <CommandGroup>
                  <CommandItem value={`add-${typed}`} disabled={busy} onSelect={add}>
                    <Plus />
                    Add &ldquo;{typed}&rdquo; as a new category
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {shown.length > 0 ? (
                <CommandGroup>
                  {shown.map((c) => (
                    <CommandItem key={c.name} value={c.name} onSelect={() => choose(c.name)} className="group/cat">
                      <Check className={cn(value === c.name ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{categoryLabel(c.name)}</span>
                      {PROTECTED_CATEGORIES.includes(c.name) ? null : (
                        <button
                          type="button"
                          disabled={busy}
                          title={c.items > 0 ? `${c.items} ${c.items === 1 ? "model is" : "models are"} in this category` : "Remove this category"}
                          aria-label={`Remove ${categoryLabel(c.name)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(c.name);
                          }}
                          className={cn("grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive", c.items > 0 && "opacity-40")}
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {!typed && shown.length === 0 ? <CommandEmpty>No categories yet. Type one to add it.</CommandEmpty> : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
