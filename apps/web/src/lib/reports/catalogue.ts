// The reports a customer can open on the Downloads tab, by category: the time-series reports the device's own metrics allow
// (solar, battery, load, grid, combined, health), plus the ones worked out from the daily energy and the tariff (the day-by-day
// energy, the month's statement and the month-by-month bills). Pure data, so the picker and its tests share it.

import { REPORT_TYPES, type AvailableReport, type ReportType } from "@/lib/report-types";
import type { CustomReportDef } from "./custom-report";

export type CenterKind = "series" | "energy" | "bills" | "statement";

export interface CenterReport {
  id: string;
  label: string;
  kind: CenterKind;
  description: string;
}

export interface CenterCategory {
  id: string;
  label: string;
  reports: CenterReport[];
}

const SERIES_GROUPS: ReportType["group"][] = ["Solar", "Battery", "Load", "Grid", "Combined", "Health"];

/** The built-in custom reports: which parameters they show. */
export const BUILTIN_DEFS: Record<"energy" | "bills", { name: string; series: CustomReportDef["series"] }> = {
  energy: { name: "Day-by-day energy", series: [{ param: "pv" }, { param: "load" }, { param: "import" }, { param: "export" }, { param: "selfUse" }, { param: "covered" }] },
  bills: { name: "Month-by-month bills", series: [{ param: "billWithout" }, { param: "billWith" }, { param: "saved" }, { param: "pv" }, { param: "load" }] },
};

export function buildCatalogue(available: AvailableReport[]): CenterCategory[] {
  const have = new Set(available.map((a) => a.id));
  const out: CenterCategory[] = [
    { id: "overview", label: "Overview", reports: [{ id: "energy", label: "Day-by-day energy", kind: "energy", description: "Generated, used, bought and sent for each day, with how much of it was used on site." }] },
  ];
  for (const g of SERIES_GROUPS) {
    const reports = REPORT_TYPES.filter((t) => t.group === g && have.has(t.id)).map<CenterReport>((t) => ({ id: t.id, label: t.label, kind: "series", description: t.description }));
    if (reports.length > 0) out.push({ id: g.toLowerCase(), label: g, reports });
  }
  out.push({
    id: "cost",
    label: "Cost & savings",
    reports: [
      { id: "statement", label: "Monthly statement", kind: "statement", description: "The month's energy, the bill with and without solar, the carbon avoided and every day." },
      { id: "bills", label: "Month-by-month bills", kind: "bills", description: "Each month's bill with and without solar, and what was saved." },
    ],
  });
  return out;
}
