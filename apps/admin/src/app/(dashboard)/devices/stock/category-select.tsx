"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { categoryLabel } from "../stock-types";

/**
 * The category of a stock item: open the list, type to search it, pick one. When what was typed is not in the list, the first line offers to add it
 * as a new category, right there. The form receives the chosen name as `category`.
 */
export function CategorySelect({ categories, defaultValue }: { categories: string[]; defaultValue?: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [value, setValue] = React.useState(defaultValue ?? "");
  // a category added here stays in the list for the rest of the form
  const [added, setAdded] = React.useState<string[]>([]);

  const options = React.useMemo(() => {
    const all = new Set([...categories, ...added, ...(defaultValue ? [defaultValue] : [])]);
    return [...all].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  }, [categories, added, defaultValue]);

  const typed = query.trim();
  const q = typed.toLowerCase();
  const shown = q ? options.filter((c) => categoryLabel(c).toLowerCase().includes(q) || c.toLowerCase().includes(q)) : options;
  const exists = options.some((c) => c.toLowerCase() === q || categoryLabel(c).toLowerCase() === q);

  function choose(next: string) {
    setValue(next);
    setOpen(false);
    setQuery("");
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
                  <CommandItem
                    value={`add-${typed}`}
                    onSelect={() => {
                      setAdded((a) => [...a, typed]);
                      choose(typed);
                    }}
                  >
                    <Plus />
                    Add &ldquo;{typed}&rdquo; as a new category
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {shown.length > 0 ? (
                <CommandGroup>
                  {shown.map((c) => (
                    <CommandItem key={c} value={c} onSelect={() => choose(c)}>
                      <Check className={cn(value === c ? "opacity-100" : "opacity-0")} />
                      {categoryLabel(c)}
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
