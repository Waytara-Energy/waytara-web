// The carbon pack as a CSV: the dataset a verifier, an auditor or an aggregator reads. A short header that says what the numbers are and how they were made, the
// totals, month by month, then every day. One sheet a spreadsheet can open.

import { dayGapLines, dayGapsSummary, gapsCsv } from "@/lib/data-gaps";
import type { CarbonPack } from "./carbon-data";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const n = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "" : v.toFixed(d));

export function carbonCsv(p: CarbonPack): string {
  const t = p.totals;
  const lines: (string | number)[][] = [
    ["WayTara carbon and sustainability report", p.period.label],
    ["Report ID", p.id],
    ["Method version", p.methodVersion],
    ["Customer", p.customerName],
    ["Site", p.siteName ?? ""],
    ["Device", p.deviceLabel ?? ""],
    ["Period", `${p.period.from} to ${p.period.to}${p.period.partial ? ", so far" : ""}`],
    ["Days with readings", `${t.days} of ${t.daysInPeriod}, ${t.completeness}%`],
    ["Time zone", "IST (India Standard Time)"],
    ["Generated at", p.generatedAt],
    [],
    ["Data source", "Inverter-measured: the inverter's own counters, not the electricity board's revenue-grade meter. Estimates."],
    ["Emission factor kg CO2/kWh", p.factor.kgPerKwh],
    ["Emission factor source", p.factor.note],
    ["Method", "CO2 avoided = solar generated kWh x grid emission factor. Grid CO2 (location-based Scope 2 estimate) = grid electricity bought kWh x grid emission factor."],
    ["Status", "Not a carbon credit and not verified. No claim to any credit or certificate is made by this report."],
    [],
    ["Summary", "Value", "Unit"],
    ["Solar generated", n(t.pvKwh), "kWh"],
    ["CO2 avoided", n(t.co2AvoidedKg, 1), "kg"],
    ["Trees a year that absorb as much (estimate)", n(t.trees, 1), "trees"],
    ["Petrol-car km that give off as much (estimate)", n(t.carKm, 0), "km"],
    ["Grid electricity bought", n(t.importKwh), "kWh"],
    ["Grid CO2, location-based Scope 2 estimate", n(t.gridCo2Kg, 1), "kg"],
    ...(p.sinceCommissioning
      ? [
          ["Generated since commissioning (lifetime counter)", n(p.sinceCommissioning.pvKwh, 0), "kWh"],
          ["CO2 avoided since commissioning", n(p.sinceCommissioning.co2AvoidedKg, 0), "kg"],
        ]
      : []),
    [],
    ["Month", "Days with readings", "Days in period", "Generated kWh", "CO2 avoided kg", "Bought kWh", "Grid CO2 kg"],
    ...p.months.map((m) => [m.month, m.days, m.daysInPeriod, n(m.pvKwh), n(m.co2AvoidedKg, 1), n(m.importKwh), n(m.gridCo2Kg, 1)]),
    [],
    ["Day", "Generated kWh", "Bought kWh", "CO2 avoided kg"],
    ...p.daily.map((d) => [d.day, n(d.pvKwh), n(d.importKwh), n(d.co2AvoidedKg, 2)]),
    [],
    ["Not held by WayTara", "Meter calibration records, the electricity board's revenue-grade meter readings, and ownership or registration documents. A verifier will ask for these."],
  ];
  // the days with no reading follow the rows (nothing is added when there are none)
  return [...lines.map((l) => l.map(cell).join(",")), ...gapsCsv(dayGapLines(p.gaps), dayGapsSummary(p.gaps), cell)].join("\r\n");
}
