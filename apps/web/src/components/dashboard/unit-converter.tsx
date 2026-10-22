"use client";

import * as React from "react";
import { ArrowLeftRight, Calculator, Check, Copy } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QUANTITIES, convert, formatConverted, quantityOfUnit } from "@/lib/unit-convert";

const unitsOf = (quantity: string) => QUANTITIES.find((q) => q.id === quantity)?.units ?? [];

/** The converter itself: a value, the unit it is in, the unit wanted, and the answer. `quantity` / `unit` open it ready for a setting. */
function ConverterPanel({ quantity: q0, unit: u0 }: { quantity?: string; unit?: string }) {
  const start = q0 ?? "power";
  const startUnits = unitsOf(start);
  const [quantity, setQuantity] = React.useState(start);
  const [from, setFrom] = React.useState(u0 ?? startUnits[0]?.id ?? "");
  const [to, setTo] = React.useState(startUnits.find((u) => u.id !== (u0 ?? startUnits[0]?.id))?.id ?? startUnits[0]?.id ?? "");
  const [text, setText] = React.useState("1");
  const [copied, setCopied] = React.useState(false);

  const value = Number(text.replace(/,/g, ""));
  const result = text.trim() === "" ? null : convert(value, quantity, from, to);
  const shown = formatConverted(result);

  const changeQuantity = (id: string) => {
    const units = unitsOf(id);
    setQuantity(id);
    setFrom(units[0]?.id ?? "");
    setTo(units[1]?.id ?? units[0]?.id ?? "");
  };

  async function copy() {
    if (result === null) return;
    try {
      await navigator.clipboard.writeText(String(Number(result.toPrecision(6))));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Could not copy. Select the number and copy it.");
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Unit converter</p>
        <p className="text-xs text-muted-foreground">Work out a value in the unit a setting asks for.</p>
      </div>

      <Select value={quantity} onValueChange={changeQuantity}>
        <SelectTrigger aria-label="What to convert" className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUANTITIES.map((q) => (
            <SelectItem key={q.id} value={q.id}>
              {q.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" aria-label="Value" className="h-9" />
        <Select value={from} onValueChange={setFrom}>
          <SelectTrigger aria-label="From unit" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitsOf(quantity).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Swap the units" onClick={() => { setFrom(to); setTo(from); }}>
          <ArrowLeftRight className="size-3.5 rotate-90" />
        </Button>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <div className="flex h-9 items-center rounded-md border border-border bg-muted/50 px-3 text-sm font-semibold tabular-nums text-foreground" aria-live="polite">
          {shown}
        </div>
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger aria-label="To unit" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitsOf(quantity).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full" disabled={result === null} onClick={() => void copy()}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy the result"}
      </Button>
    </div>
  );
}

/** The "Unit converter" button of the Devices page. */
export function UnitConverterButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="ml-auto shrink-0">
          <Calculator className="size-3.5" />
          Unit converter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <ConverterPanel />
      </PopoverContent>
    </Popover>
  );
}

/** A small calculator beside a setting whose unit can be converted; it opens the converter ready for that unit. Nothing for other units. */
export function UnitConverterIcon({ unit }: { unit: string | null | undefined }) {
  const preset = quantityOfUnit(unit);
  if (!preset) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Convert from ${unit}`} className="ml-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <Calculator className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ConverterPanel quantity={preset.quantity} unit={preset.unit} />
      </PopoverContent>
    </Popover>
  );
}
