"use client";

import * as React from "react";
import { Clock, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { normalizeWindow } from "@/lib/report-types";

export interface PickGroup {
  id: string;
  label: string;
  items: { id: string; label: string; unit?: string; hint?: string }[];
}

/** The things picked so far, each a removable chip (a coloured dot when it has a colour on the chart). */
export function FilterChips({ items, onRemove }: { items: { id: string; label: string; color?: string }[]; onRemove: (id: string) => void }) {
  return (
    <>
      {items.map((it) => (
        <Badge key={it.id} variant="secondary" className="h-7 gap-1.5 pr-1 pl-2.5 font-medium">
          {it.color && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: it.color }} />}
          {it.label}
          <button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.label}`} className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground">
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </>
  );
}

/** A searchable, grouped list with a tick box on each row: pick as many as wanted without the list closing. */
export function MultiPicker({ groups, selected, onChange, max, label, searchPlaceholder }: { groups: PickGroup[]; selected: string[]; onChange: (ids: string[]) => void; max: number; label: string; searchPlaceholder: string }) {
  const [open, setOpen] = React.useState(false);
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 rounded-full border-dashed px-2.5 text-xs">
          <Plus className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.id} heading={g.label}>
                {g.items.map((it) => {
                  const on = selected.includes(it.id);
                  return (
                    <CommandItem key={it.id} value={`${g.label} ${it.label}`} onSelect={() => toggle(it.id)} disabled={!on && selected.length >= max}>
                      <Checkbox checked={on} tabIndex={-1} aria-hidden className="pointer-events-none" />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.unit && <span className="text-xs text-muted-foreground">{it.unit}</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>{selected.length} selected</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={selected.length === 0} onClick={() => onChange([])}>
                Clear
              </Button>
              <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const TIME_PRESETS: { id: string; label: string; from: string; to: string }[] = [
  { id: "all", label: "All day", from: "00:00", to: "23:59" },
  { id: "morning", label: "Morning", from: "06:00", to: "12:00" },
  { id: "afternoon", label: "Afternoon", from: "12:00", to: "18:00" },
  { id: "evening", label: "Evening", from: "18:00", to: "22:00" },
  { id: "sun", label: "Sun hours", from: "08:00", to: "17:00" },
];

export interface DayWindow {
  from: string;
  to: string;
}
export const ALL_DAY: DayWindow = { from: "00:00", to: "23:59" };
export const isAllDay = (w: DayWindow) => w.from === ALL_DAY.from && w.to === ALL_DAY.to;
export const windowIsValid = (w: DayWindow) => isAllDay(w) || normalizeWindow(w.from, w.to) !== null;
export const windowLabel = (w: DayWindow) => (isAllDay(w) ? "All day" : `${w.from} – ${w.to >= "23:59" ? "24:00" : w.to}`);

/** The part of each day to look at: quick choices plus a from and a to time. */
export function TimeOfDayFilter({ value, onChange }: { value: DayWindow; onChange: (w: DayWindow) => void }) {
  const preset = TIME_PRESETS.find((p) => p.from === value.from && p.to === value.to)?.id ?? "";
  const valid = windowIsValid(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" aria-label={`Time of day: ${windowLabel(value)}`}>
          <Clock className="size-3.5" />
          <span className={valid ? "" : "text-destructive"}>{windowLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] space-y-3 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Time of day</p>
          <p className="text-xs text-muted-foreground">Only these hours of each day, India time.</p>
        </div>
        <ToggleGroup type="single" variant="outline" size="sm" value={preset} onValueChange={(v) => { const p = TIME_PRESETS.find((x) => x.id === v); if (p) onChange({ from: p.from, to: p.to }); }} className="flex flex-wrap justify-start gap-1" aria-label="Quick choices">
          {TIME_PRESETS.map((p) => (
            <ToggleGroupItem key={p.id} value={p.id} className="h-8 px-2.5 text-xs">
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            From
            <Input type="time" step={900} value={value.from} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} className="h-9 appearance-none bg-background text-foreground [&::-webkit-calendar-picker-indicator]:hidden" />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            To
            <Input type="time" step={900} value={value.to} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} className="h-9 appearance-none bg-background text-foreground [&::-webkit-calendar-picker-indicator]:hidden" />
          </label>
        </div>
        {!valid && <p className="text-xs text-destructive">Start must be earlier than the end.</p>}
      </PopoverContent>
    </Popover>
  );
}
