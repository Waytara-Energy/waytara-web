"use client";

import * as React from "react";
import { resolveKind } from "@/lib/chart-style";
import { ChartCore, type ChartRow } from "./chart-kit";
import { useChartStyle } from "./chart-style";

export interface DivergingPoint {
  date: string; // YYYY-MM-DD
  positive: number;
  negative: number;
}

function formatLabel(date: string, withYear = false): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "2-digit" as const } : {}) });
}

/** Two-series polarity comparison (battery charge vs discharge, grid import vs export): each day's positive series climbs above the
 *  zero line, the negative one hangs below it, as bars (or as two lines, when chosen in Application Settings). The value pointed at
 *  is written under the title, with the date and each series' colour node. Colours follow the same favorable/drawing convention as
 *  the Overview flow diagram (green = charging/exporting, amber = discharging/importing), not the app's categorical palette -
 *  they encode direction here too. */
export function DivergingBarChart({
  data,
  positiveLabel,
  negativeLabel,
  unit = "kWh",
  positiveColor = "#10b981",
  negativeColor = "#f59e0b",
}: {
  data: DivergingPoint[];
  positiveLabel: string;
  negativeLabel: string;
  unit?: string;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const kind = resolveKind(useChartStyle(), "bar");
  const withYear = data.length > 300;
  const rows = React.useMemo<ChartRow[]>(
    () => data.map((d) => ({ __tick: formatLabel(d.date, withYear), __label: formatLabel(d.date, true), positive: d.positive, negative: -d.negative })),
    [data, withYear]
  );
  return (
    <ChartCore
      rows={rows}
      series={[
        { key: "positive", label: positiveLabel, color: positiveColor },
        { key: "negative", label: negativeLabel, color: negativeColor },
      ]}
      kind={kind}
      stacked
      zeroLine
      format={(v) => ({ num: Math.abs(v).toFixed(1), unit })}
    />
  );
}
