"use client";

import * as React from "react";
import type { AvailableReport } from "@/lib/report-types";
import type { ReportsBase } from "@/lib/reports/gather";
import type { RunView, SavedReportView } from "@/lib/reports/saved-report-view";
import { MyReports } from "./my-reports";
import { ReportCenter } from "./report-center";

/** The Generate tab: the customer's own reports first (create, schedule, send), then the report viewer with its one pair of
 *  CSV and PDF downloads. */
export function ReportsDownloads({ base, customerId, reports, runs, available }: { base: ReportsBase; customerId: string; reports: SavedReportView[]; runs: RunView[]; available: AvailableReport[] }) {
  return (
    <div className="space-y-8">
      <MyReports base={base} customerId={customerId} reports={reports} runs={runs} />
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Detailed report</h2>
          <p className="text-xs text-muted-foreground">Filter by what to show, the period and the hours of the day, see it as a graph or a table, and download it as CSV or PDF.</p>
        </div>
        <ReportCenter base={base} available={available} />
      </section>
    </div>
  );
}
