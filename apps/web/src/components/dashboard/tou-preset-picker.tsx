"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applySettingPreset } from "@/app/dashboard/devices/[deviceId]/actions";

export interface TouPresetOption {
  key: string;
  name: string;
  description: string;
  /** Formatted "HH:MM-HH:MM, ..." grid-charge windows, or null if the
   *  template never charges from the grid. */
  gridWindowsText: string | null;
  /** This device's own average grid draw (W) during those windows over
   *  the last 7 days — null if there isn't enough history yet. */
  averageGridDrawW: number | null;
}

/** Replaces raw per-slot Time-of-Use editing (those write registers are
 *  min_role 'employee' in instrument_catalog, above what a customer can
 *  touch directly) with a pick-a-template flow: applying one writes its
 *  whole values set through the same device_settings pipeline as any
 *  individual field edit. Each card's "your data" line is computed from
 *  this device's own recent readings, not a generic claim. */
export function TouPresetPicker({
  deviceId,
  presets,
  currentPresetKey,
}: {
  deviceId: string;
  presets: TouPresetOption[];
  currentPresetKey: string | null;
}) {
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function apply(key: string) {
    setPendingKey(key);
    startTransition(async () => {
      const result = await applySettingPreset(deviceId, key);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Time-of-Use template applied.");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {presets.map((preset) => {
        const isActive = preset.key === currentPresetKey;
        const isPending = pending && pendingKey === preset.key;
        return (
          <Card key={preset.key} className={isActive ? "border-primary" : undefined}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{preset.name}</CardTitle>
                {isActive && (
                  <Badge variant="default" className="shrink-0 gap-1">
                    <CheckCircle2 className="size-3.5" />
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-theme-muted">{preset.description}</p>
              <p className="text-xs text-theme-muted">
                {preset.gridWindowsText
                  ? `Charges from the grid: ${preset.gridWindowsText}${
                      preset.averageGridDrawW !== null
                        ? ` — you've averaged ${Math.round(preset.averageGridDrawW)} W of grid draw there over the last 7 days.`
                        : "."
                    }`
                  : "Never charges from the grid — the battery only fills from your own solar."}
              </p>
              <Button type="button" size="sm" variant={isActive ? "outline" : "default"} disabled={pending} onClick={() => apply(preset.key)}>
                <ButtonSpinner show={isPending} />
                {isActive ? "Re-apply" : "Apply template"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
