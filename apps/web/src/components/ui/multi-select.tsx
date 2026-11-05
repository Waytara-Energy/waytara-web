"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  /** Unique across all options (two places can share a name). */
  value: string;
  label: string;
  /** Shown as a heading over the options that share it (for example the state of a city). */
  group?: string;
}

/**
 * A searchable list where any number of options can be ticked, built from shadcn's Popover and Command. The ticked options show as chips under the
 * field, each with a button to remove it. With `allowCustom`, typing something that is not in the list offers to add it.
 */
export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  allowCustom = false,
  disabled = false,
  "aria-invalid": invalid,
}: {
  id?: string;
  options: MultiSelectOption[];
  /** The values that are ticked. */
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  allowCustom?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const labels = React.useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const chosen = new Set(value);

  const toggle = (v: string) => onChange(chosen.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  const typed = query.trim();
  const canAdd = allowCustom && typed.length >= 2 && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase()) && !value.some((v) => v.toLowerCase() === typed.toLowerCase());

  const groups = React.useMemo(() => {
    const map = new Map<string, MultiSelectOption[]>();
    for (const o of options) map.set(o.group ?? "", [...(map.get(o.group ?? "") ?? []), o]);
    return [...map.entries()];
  }, [options]);

  return (
    <div>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            data-invalid={invalid ? "true" : undefined}
            disabled={disabled}
            className={cn(
              "flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-theme-border bg-theme-surface px-4 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 data-[invalid=true]:border-red-500/60",
              value.length === 0 ? "text-theme-muted" : "text-theme-primary"
            )}
          >
            <span className="truncate">{value.length === 0 ? placeholder : `${value.length} selected`}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
            <CommandList className="max-h-64">
              <CommandEmpty>{emptyText}</CommandEmpty>
              {groups.map(([group, items]) => (
                <CommandGroup key={group} heading={group || undefined}>
                  {items.map((o) => (
                    <CommandItem key={o.value} value={`${o.label} ${o.group ?? ""}`} onSelect={() => {
                        toggle(o.value);
                        setQuery("");
                      }}>
                      <Check className={cn("size-4", chosen.has(o.value) ? "opacity-100 text-emerald-500" : "opacity-0")} aria-hidden="true" />
                      {o.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {canAdd && (
                <CommandGroup>
                  <CommandItem
                    forceMount
                    value={`add ${typed}`}
                    onSelect={() => {
                      onChange([...value, typed]);
                      setQuery("");
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add “{typed}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 py-1 pl-3 pr-1.5 text-sm text-theme-primary ring-1 ring-emerald-500/25">
              {labels.get(v) ?? v}
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`Remove ${labels.get(v) ?? v}`}
                className="flex size-5 items-center justify-center rounded-full text-theme-muted transition-colors hover:bg-emerald-500/20 hover:text-theme-primary"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
