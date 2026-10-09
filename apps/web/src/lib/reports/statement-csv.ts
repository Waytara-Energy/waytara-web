// A monthly statement as CSV: the comparison, the bill, then the day-by-day rows (one sheet a spreadsheet can open).

import type { StatementData } from "./statement-data";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const n = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "" : v.toFixed(d));

export function statementCsv(s: StatementData): string {
  const c = s.current;
  const lines: (string | number)[][] = [
    ["Monthly energy statement", s.label],
    ["Customer", s.customerName],
    ["Site", s.siteName ?? ""],
    ["Device", s.deviceLabel ?? ""],
    ["Period", `${s.from} to ${s.to}${s.partial ? ", month so far" : ""}`],
    ["Days with readings", `${c.days}, ${s.completeness}%`],
    [],
    ["Energy kWh", s.label, s.partial ? "Month before, same days" : "Month before", s.partial ? "Last year, same days" : "Same month last year"],
    ["Generated", n(c.pvKwh), n(s.previous?.pvKwh), n(s.lastYear?.pvKwh)],
    ["Used", n(c.loadKwh), n(s.previous?.loadKwh), n(s.lastYear?.loadKwh)],
    ["Bought from the grid", n(c.importKwh), n(s.previous?.importKwh), n(s.lastYear?.importKwh)],
    ["Sent to the grid", n(c.exportKwh), n(s.previous?.exportKwh), n(s.lastYear?.exportKwh)],
    ["Solar used on site %", n(c.selfUsePct, 0), n(s.previous?.selfUsePct, 0), n(s.lastYear?.selfUsePct, 0)],
    ["Home covered by solar %", n(c.selfSufficiencyPct, 0), n(s.previous?.selfSufficiencyPct, 0), n(s.lastYear?.selfSufficiencyPct, 0)],
    [],
    ["Bill Rs.", s.bill.exact ? "Worked out on the month's units" : "An estimate: a share of the month's bill"],
    ["Without solar", n(s.bill.withoutSolar, 0)],
    ["With solar", n(s.bill.withSolar, 0)],
    ["Saved", n(s.bill.saved, 0)],
    ["Saved since commissioning", n(s.savedSinceCommissioning, 0)],
    ["CO2 avoided kg", n(s.co2Kg, 1)],
    [],
    ["Day", "Generated kWh", "Used kWh", "Bought kWh", "Sent kWh"],
    ...s.daily.map((d) => [d.day, n(d.pvKwh ?? 0), n(d.loadKwh), n(d.importKwh), n(d.exportKwh)]),
    [],
    ["Tariff", s.tariffNote],
    ["CO2 factor", s.co2Note],
    ["Source", "The inverter's own counters, not the electricity board's meter; estimates."],
  ];
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}
