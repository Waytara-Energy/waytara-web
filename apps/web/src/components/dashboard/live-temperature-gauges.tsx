"use client";

import * as React from "react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { TemperatureGauge } from "./temperature-gauge";

export interface GaugeSpec {
  key: string;
  label: string;
  warnAboveC: number;
  /** About a day ago, for the trend arrow. */
  previousC: number | null;
}

/** The Maintenance temperature gauges, following the device's live channel in place. `initial` is the server's
 *  reading (shown until the first live value arrives). */
export function LiveTemperatureGauges({ deviceId, gauges, initial }: { deviceId: string; gauges: GaugeSpec[]; initial: Record<string, number | null> }) {
  const keys = React.useMemo(() => gauges.map((g) => g.key), [gauges]);
  const live = useLiveNumbers([deviceId], keys, initial, () => "first");
  return (
    <>
      {gauges.map((g) => (
        <TemperatureGauge key={g.key} label={g.label} valueC={live[g.key] ?? initial[g.key] ?? null} warnAboveC={g.warnAboveC} previousValueC={g.previousC} />
      ))}
    </>
  );
}
