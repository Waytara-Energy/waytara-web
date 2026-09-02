"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHARGE_SOURCE_OPTIONS } from "@/lib/instrument-settings-catalog";
import type { TouSlot } from "@/lib/time-of-use";
import { updateTimeOfUse } from "@/app/dashboard/settings/instruments/actions";

/** Prog1-6 Time-of-Use schedule, edited and saved as one set (not per-row
 *  like the generic catalog fields) — validated client-side for instant
 *  feedback, then re-validated server-side before it ever reaches
 *  `device_settings`. */
export function TimeOfUseEditor({ initialSlots }: { initialSlots: TouSlot[] }) {
  const [slots, setSlots] = React.useState<TouSlot[]>(initialSlots);
  const [pending, startTransition] = React.useTransition();

  function updateSlot(index: number, patch: Partial<TouSlot>) {
    setSlots((prev) => prev.map((s) => (s.index === index ? { ...s, ...patch } : s)));
  }

  function save() {
    startTransition(async () => {
      const result = await updateTimeOfUse(slots);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Time-of-Use schedule saved.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-theme-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prog</TableHead>
              <TableHead>Start time</TableHead>
              <TableHead>Power (W)</TableHead>
              <TableHead>Capacity (%)</TableHead>
              <TableHead>Charge source</TableHead>
              <TableHead>Sell to grid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.map((slot) => (
              <TableRow key={slot.index}>
                <TableCell className="font-medium text-theme-primary">Prog{slot.index}</TableCell>
                <TableCell>
                  <Input
                    type="time"
                    className="w-28"
                    value={slot.startTime}
                    disabled={pending}
                    onChange={(e) => updateSlot(slot.index, { startTime: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={8000}
                    step={100}
                    className="w-24"
                    value={slot.powerW}
                    disabled={pending}
                    onChange={(e) => updateSlot(slot.index, { powerW: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="w-20"
                    value={slot.capacityPct}
                    disabled={pending}
                    onChange={(e) => updateSlot(slot.index, { capacityPct: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={slot.chargeSource}
                    disabled={pending}
                    onValueChange={(v) => updateSlot(slot.index, { chargeSource: v as TouSlot["chargeSource"] })}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHARGE_SOURCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={slot.gridSellEnabled}
                    disabled={pending}
                    onCheckedChange={(checked) => updateSlot(slot.index, { gridSellEnabled: checked })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" size="sm" disabled={pending} onClick={save}>
        Save schedule
      </Button>
    </div>
  );
}
