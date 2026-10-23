"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { minutesText } from "@/lib/session-policy";
import { cn } from "@/lib/utils";

interface Option {
  minutes: number | null;
  label: string;
  hint?: string;
}

const UNITS = [
  { id: "minutes", label: "minutes", size: 1 },
  { id: "hours", label: "hours", size: 60 },
  { id: "days", label: "days", size: 1440 },
] as const;
type UnitId = (typeof UNITS)[number]["id"];

/** A value in minutes, written as the largest unit that divides it: 90 -> 90 minutes, 120 -> 2 hours, 2880 -> 2 days. */
function split(minutes: number): { amount: string; unit: UnitId } {
  const unit = [...UNITS].reverse().find((u) => minutes % u.size === 0) ?? UNITS[0];
  return { amount: String(minutes / unit.size), unit: unit.id };
}

/**
 * Choose a length of time: a row of presets (and "no limit" as the null one) and a "Custom" chip that opens a number and a unit (minutes, hours or
 * days) for any time between `min` and `max` minutes. The number is clamped into that range when the field is left.
 */
export function DurationPicker({ label, options, value, onChange, min, max, customLabel = "Custom" }: { label: string; options: Option[]; value: number | null; onChange: (minutes: number | null) => void; min: number; max: number; customLabel?: string }) {
  const preset = options.some((o) => o.minutes === value);
  const [custom, setCustom] = React.useState(value !== null && !preset);
  const [amount, setAmount] = React.useState(() => (value !== null && !preset ? split(value).amount : ""));
  const [unit, setUnit] = React.useState<UnitId>(() => (value !== null && !preset ? split(value).unit : "hours"));
  const showCustom = custom && !preset;

  function commit(nextAmount: string, nextUnit: UnitId) {
    const size = UNITS.find((u) => u.id === nextUnit)!.size;
    const n = Math.round(Number(nextAmount) * size);
    const minutes = Math.min(max, Math.max(min, Number.isFinite(n) && n > 0 ? n : min));
    const back = split(minutes);
    setAmount(back.amount);
    setUnit(back.unit);
    onChange(minutes);
  }

  function chooseCustom() {
    setCustom(true);
    if (!amount) commit("45", "minutes");
    else commit(amount, unit);
  }

  const chip = (on: boolean) => cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent");

  return (
    <div className="space-y-2.5">
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        {options.map((o) => {
          const on = value === o.minutes;
          return (
            <button
              key={String(o.minutes)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setCustom(false);
                onChange(o.minutes);
              }}
              className={chip(on)}
            >
              <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary" : "border-muted-foreground/40")}>{on && <span className="size-2 rounded-full bg-primary" />}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{o.label}</span>
                {o.hint ? <span className="block truncate text-xs text-muted-foreground">{o.hint}</span> : null}
              </span>
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={showCustom} onClick={chooseCustom} className={chip(showCustom)}>
          <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", showCustom ? "border-primary" : "border-muted-foreground/40")}>{showCustom && <span className="size-2 rounded-full bg-primary" />}</span>
          <span className="block text-sm font-medium text-foreground">{customLabel}</span>
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            aria-label={`${label}: amount`}
            className="h-9 w-24"
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => commit(amount, unit)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(amount, unit);
              }
            }}
          />
          <Select
            value={unit}
            onValueChange={(v) => {
              setUnit(v as UnitId);
              commit(amount || "1", v as UnitId);
            }}
          >
            <SelectTrigger className="h-9 w-32" aria-label={`${label}: unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">From {minutesText(min)} to {minutesText(max)}.</span>
        </div>
      )}
    </div>
  );
}
