"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

export function ReportControls({ defaultDays = 90 }: { defaultDays?: number }) {
  const [days, setDays] = React.useState(defaultDays);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-theme-border p-1">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setDays(p.days)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              days === p.days
                ? "bg-theme-surface-hover text-theme-highlight"
                : "text-theme-muted hover:text-theme-primary"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/reports/energy.csv?days=${days}`}>Download CSV</a>
        </Button>
        <Button asChild size="sm">
          <a href={`/api/reports/summary.pdf?days=${days}`}>Download PDF summary</a>
        </Button>
      </div>
    </div>
  );
}
