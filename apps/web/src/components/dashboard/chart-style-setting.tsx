"use client";

import { BarChart3, LineChart, Sparkles } from "lucide-react";
import { CHART_STYLES, type ChartStyle } from "@/lib/chart-style";
import { cn } from "@/lib/utils";
import { useChartStyle, useSetChartStyle } from "./chart-style";

const OPTIONS: Record<ChartStyle, { label: string; hint: string; icon: typeof LineChart }> = {
  auto: { label: "Automatic", hint: "Each chart in the style that suits it", icon: Sparkles },
  line: { label: "Line", hint: "Every chart as a line", icon: LineChart },
  bar: { label: "Bar", hint: "Every chart as bars", icon: BarChart3 },
};

/** Application Settings: how charts are drawn everywhere (Overview, Monitoring, Performance). It applies the moment it is chosen and is
 *  remembered in this browser. */
export function ChartStyleSetting() {
  const style = useChartStyle();
  const setStyle = useSetChartStyle();
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Charts</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose how every chart is drawn. The change applies straight away.</p>
      </div>
      <div role="radiogroup" aria-label="Chart style" className="grid grid-cols-3 gap-2">
        {CHART_STYLES.map((value) => {
          const { label, hint, icon: Icon } = OPTIONS[value];
          const selected = style === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setStyle(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className={cn("size-5", selected && "text-primary")} />
              <span className="text-sm font-medium">{label}</span>
              <span className="text-[11px] leading-tight opacity-80">{hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
