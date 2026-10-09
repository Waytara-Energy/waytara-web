import { describe, expect, it } from "vitest";
import type { Bill, DayEnergy, MonthRow } from "@/lib/savings";
import { buildCustomReport, resolvePeriod, unitGroups, type ReportInput } from "./custom-report";
import { customReportCsv } from "./custom-report-csv";
import { allRecipients, parseEmails } from "./recipients";
import { describeSchedule, nextRunAt } from "./schedule";
import { reportFormSchema } from "./saved-report";

const d = (day: string, pv: number, load: number, imp: number, exp: number, ch?: number): DayEnergy => ({ day, pvKwh: pv, loadKwh: load, importKwh: imp, exportKwh: exp, chargedKwh: ch });
const bill = (saved: number): Bill => ({ withoutSolar: saved * 2, withSolar: saved, avoided: saved, exportIncome: 0, saved, banked: 0 });
const month = (m: string, saved: number): MonthRow => ({ month: m, label: m, bill: bill(saved), days: 0, energy: { loadKwh: 0, importKwh: 0, exportKwh: 0 } });

const input: ReportInput = {
  customerName: "A",
  siteName: "Home",
  deviceLabel: "Inverter",
  generatedAt: "2026-10-09T10:00:00Z",
  tariffNote: "T",
  co2KgPerKwh: 0.5,
  co2Note: "N",
  days: [d("2026-09-20", 10, 5, 1, 4), d("2026-10-01", 20, 10, 2, 12, 3), d("2026-10-02", 10, 8, 4, 6, 1), d("2026-10-03", 30, 6, 0, 24)],
  months: [month("2026-09", 300), month("2026-10", 600)],
};
const TODAY = "2026-10-09";

describe("resolvePeriod", () => {
  it("turns each preset into dates", () => {
    expect(resolvePeriod("last7", TODAY)).toMatchObject({ from: "2026-10-03", to: "2026-10-09" });
    expect(resolvePeriod("thisMonth", TODAY)).toMatchObject({ from: "2026-10-01", to: "2026-10-09" });
    expect(resolvePeriod("lastMonth", TODAY)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod("last12m", TODAY).from).toBe("2025-10-10");
  });
  it("never runs past today", () => {
    expect(resolvePeriod({ from: "2026-10-01", to: "2026-12-31" }, TODAY).to).toBe(TODAY);
    expect(resolvePeriod({ from: "2026-10-09", to: "2026-10-09" }, TODAY).label).toBe("9 Oct 2026");
  });
});

describe("buildCustomReport", () => {
  it("works out a one-parameter report day by day", () => {
    const r = buildCustomReport(input, { name: " Solar ", series: [{ param: "pv", label: "My solar" }], period: "thisMonth" }, TODAY);
    expect(r.name).toBe("Solar");
    expect(r.comparison).toBe(false);
    expect(r.granularity).toBe("day");
    expect(r.buckets.map((b) => b.key)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(r.series[0]).toMatchObject({ label: "My solar", unit: "kWh", total: 60, avg: 20, min: 10, max: 30 });
  });

  it("compares parameters from different categories, each under its own display name", () => {
    const r = buildCustomReport(input, { name: "Mix", series: [{ param: "pv" }, { param: "covered", label: "Home covered" }, { param: "co2" }], period: "thisMonth" }, TODAY);
    expect(r.comparison).toBe(true);
    expect(r.series.map((s) => s.label)).toEqual(["Solar generated", "Home covered", "CO₂ avoided"]);
    expect(r.series[1].total).toBeCloseTo(75, 0); // (24 - 6) / 24: the period's own ratio, not an average of the days
    expect(r.series[2].total).toBe(30); // 60 kWh x 0.5
    expect(unitGroups(r).map((g) => g.unit)).toEqual(["kWh", "%", "kg"]);
  });

  it("groups by month when the report uses a money figure, and prices each month's slice of its bill", () => {
    const r = buildCustomReport(input, { name: "Bills", series: [{ param: "saved" }, { param: "pv" }], period: { from: "2026-09-01", to: "2026-10-09" } }, TODAY);
    expect(r.granularity).toBe("month");
    expect(r.buckets.map((b) => b.key)).toEqual(["2026-09", "2026-10"]);
    expect(r.series[0].values).toEqual([300, 600]); // each month has all its readings inside the period
    expect(r.series[0].total).toBe(900);
  });

  it("adds the period before and the change when asked", () => {
    const r = buildCustomReport(input, { name: "Trend", series: [{ param: "pv" }], period: "last7", comparePrevious: true }, TODAY);
    expect(r.previousPeriod).toEqual({ from: "2026-09-26", to: "2026-10-02" });
    expect(r.series[0].total).toBe(30); // 3 Oct only
    expect(r.series[0].previousTotal).toBe(30); // 1 and 2 Oct
    expect(r.series[0].changePct).toBeCloseTo(0);
  });

  it("leaves a value empty when the device does not report it", () => {
    const r = buildCustomReport(input, { name: "Battery", series: [{ param: "charged" }], period: "thisMonth" }, TODAY);
    expect(r.series[0].values).toEqual([3, 1, null]);
    expect(r.series[0].total).toBe(4);
  });

  it("ignores unknown parameters", () => {
    const r = buildCustomReport(input, { name: "x", series: [{ param: "nope" }, { param: "load" }], period: "thisMonth" }, TODAY);
    expect(r.series).toHaveLength(1);
  });
});

describe("customReportCsv", () => {
  it("has a column per parameter under its display name, then the totals", () => {
    const r = buildCustomReport(input, { name: "x", series: [{ param: "pv", label: "My solar" }, { param: "load" }], period: "thisMonth" }, TODAY);
    const lines = customReportCsv(r).split("\r\n");
    expect(lines[0]).toBe('"Day","My solar kWh","Energy used kWh"');
    expect(lines[1]).toBe('"2026-10-01","20","10"');
    expect(lines.find((l) => l.startsWith('"Total'))).toBe('"Total","60","24"');
  });
});

describe("schedule", () => {
  // India time is UTC+5:30: 08:00 IST is 02:30 UTC.
  it("finds the next daily run, today if the time has not passed", () => {
    expect(nextRunAt({ kind: "daily", time: "08:00" }, new Date("2026-10-09T01:00:00Z"))?.toISOString()).toBe("2026-10-09T02:30:00.000Z");
    expect(nextRunAt({ kind: "daily", time: "08:00" }, new Date("2026-10-09T03:00:00Z"))?.toISOString()).toBe("2026-10-10T02:30:00.000Z");
  });
  it("finds the next weekly run on the chosen weekday", () => {
    // 9 Oct 2026 is a Friday; Monday is dow 1
    expect(nextRunAt({ kind: "weekly", time: "09:30", dow: 1 }, new Date("2026-10-09T05:00:00Z"))?.toISOString()).toBe("2026-10-12T04:00:00.000Z");
  });
  it("finds the next monthly run, including the last day", () => {
    expect(nextRunAt({ kind: "monthly", time: "08:00", dom: 5 }, new Date("2026-10-09T05:00:00Z"))?.toISOString()).toBe("2026-11-05T02:30:00.000Z");
    expect(nextRunAt({ kind: "monthly", time: "08:00", dom: 0 }, new Date("2026-10-09T05:00:00Z"))?.toISOString()).toBe("2026-10-31T02:30:00.000Z");
    expect(nextRunAt({ kind: "monthly", time: "08:00", dom: 0 }, new Date("2026-02-10T05:00:00Z"))?.toISOString()).toBe("2026-02-28T02:30:00.000Z");
  });
  it("has no run when not scheduled or incomplete", () => {
    expect(nextRunAt({ kind: "none", time: "08:00" }, new Date())).toBeNull();
    expect(nextRunAt({ kind: "weekly", time: "08:00" }, new Date())).toBeNull();
  });
  it("describes itself", () => {
    expect(describeSchedule({ kind: "weekly", time: "09:30", dow: 1 })).toBe("Every Monday at 09:30");
    expect(describeSchedule({ kind: "monthly", time: "08:00", dom: 2 })).toBe("Every month on the 2nd at 08:00");
    expect(describeSchedule({ kind: "monthly", time: "08:00", dom: 0 })).toBe("Every month on the last day at 08:00");
  });
});

describe("recipients", () => {
  it("splits pasted addresses and keeps the bad ones apart", () => {
    expect(parseEmails("A@x.com, b@y.org; bad@ nope c@z.in a@x.com")).toEqual({ valid: ["a@x.com", "b@y.org", "c@z.in"], invalid: ["bad@", "nope"] });
  });
  it("puts the customer's own address first and drops repeats", () => {
    expect(allRecipients("me@x.com", true, ["ME@x.com", "b@y.org"])).toEqual(["me@x.com", "b@y.org"]);
    expect(allRecipients("me@x.com", false, ["b@y.org"])).toEqual(["b@y.org"]);
  });
});

describe("reportFormSchema", () => {
  const ok = { name: "R", params: { series: [{ param: "pv" }], period: "last30", formats: ["pdf"] }, schedule: { kind: "none", time: "08:00" }, sendToMe: true, recipients: [] };
  it("accepts a plain report and a weekly one", () => {
    expect(reportFormSchema.safeParse(ok).success).toBe(true);
    expect(reportFormSchema.safeParse({ ...ok, schedule: { kind: "weekly", time: "08:00", dow: 1 } }).success).toBe(true);
  });
  it("rejects a schedule with nobody to send it to, a missing weekday, and unknown parameters", () => {
    expect(reportFormSchema.safeParse({ ...ok, schedule: { kind: "daily", time: "08:00" }, sendToMe: false }).success).toBe(false);
    expect(reportFormSchema.safeParse({ ...ok, schedule: { kind: "weekly", time: "08:00" } }).success).toBe(false);
    expect(reportFormSchema.safeParse({ ...ok, params: { ...ok.params, series: [{ param: "nope" }] } }).success).toBe(false);
  });
});
