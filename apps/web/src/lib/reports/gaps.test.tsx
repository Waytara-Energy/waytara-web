import { describe, expect, it } from "vitest";
import { dayReportCsv } from "../report-day-csv";
import { generateDayReportPdf } from "../report-day-pdf";
import { getReportType } from "../report-types";
import type { DayReport } from "../report-day-data";
import { periodCsv } from "./period-csv";
import { daysWithoutReadings } from "./gaps";

const day = (d: string) => ({ day: d, pvKwh: 10, loadKwh: 8, importKwh: 2, exportKwh: 4 });

describe("daysWithoutReadings", () => {
  it("finds the days missing after the first reading", () => {
    const rows = [day("2026-10-01"), day("2026-10-02"), day("2026-10-06")];
    expect(daysWithoutReadings(rows, "2026-10-01", "2026-10-06", "2026-10-20")).toEqual([{ from: "2026-10-03", to: "2026-10-05", days: 3 }]);
  });
  it("leaves out today while it is going on (no reading yet is not a gap)", () => {
    const rows = [day("2026-10-01"), day("2026-10-02")];
    expect(daysWithoutReadings(rows, "2026-10-01", "2026-10-03", "2026-10-03")).toEqual([]);
    expect(daysWithoutReadings(rows, "2026-10-01", "2026-10-04", "2026-10-04")).toEqual([{ from: "2026-10-03", to: "2026-10-03", days: 1 }]);
  });
  it("has none for a period that ends before it begins, or has no readings", () => {
    expect(daysWithoutReadings([], "2026-10-01", "2026-10-05", "2026-10-20")).toEqual([]);
    expect(daysWithoutReadings([day("2026-10-01")], "2026-10-05", "2026-10-05", "2026-10-05")).toEqual([]);
  });
});

describe("periodCsv with a gap", () => {
  it("lists the gap after the rows, and adds nothing when there is none", () => {
    const rows = [day("2026-10-01"), day("2026-10-04")];
    const lines = periodCsv(rows, { from: "2026-10-01", to: "2026-10-04", today: "2026-10-20" }).split("\r\n");
    expect(lines.some((l) => l === '"Data gaps","1 period, 2 days without readings"')).toBe(true);
    expect(lines.some((l) => l === '"2 Oct 2026","3 Oct 2026","2 days"')).toBe(true);
    const clean = periodCsv([day("2026-10-01"), day("2026-10-02")], { from: "2026-10-01", to: "2026-10-02", today: "2026-10-20" });
    expect(clean).not.toContain("Data gaps");
    expect(periodCsv(rows)).not.toContain("Data gaps"); // no range given: as before
  });
});

describe("the day report with a gap", () => {
  const type = getReportType(null);
  const at = (h: number, m = 0) => `2026-10-22T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const ms = (h: number, m = 0) => Date.parse(`${at(h, m)}:00+05:30`);
  const sid = type.series[0].id;
  const points = Array.from({ length: 24 }, (_, i) => ({ time: at(Math.floor(i / 4), (i % 4) * 15), [sid]: i >= 8 && i < 14 ? null : 1.5 }));
  const report: DayReport = {
    authorized: true,
    customerName: "Asha",
    planName: "Advance",
    deviceId: "d1",
    deviceLabel: "Inverter",
    isSolar: true,
    date: "2026-10-22",
    days: 1,
    type,
    window: null,
    bucketMinutes: 15,
    coarse: false,
    points,
    summaries: [],
    hasData: true,
    gaps: [{ fromMs: ms(2), toMs: ms(3, 30), ongoing: false }],
  };

  it("prints the gap under the rows of the CSV", () => {
    const lines = dayReportCsv(report).split("\r\n");
    expect(lines.some((l) => l === '"Data gaps","1 period, 1 h 30 min without readings"')).toBe(true);
    expect(lines.some((l) => l === '"22 Oct 2026, 02:00","22 Oct 2026, 03:30","1 h 30 min"')).toBe(true);
  });

  it("has no gap section when there is no gap", () => {
    expect(dayReportCsv({ ...report, gaps: [] })).not.toContain("Data gaps");
  });

  it("makes a PDF with the gap in it", async () => {
    const pdf = await generateDayReportPdf(report, "2026-10-22T10:00:00Z");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const without = await generateDayReportPdf({ ...report, gaps: [] }, "2026-10-22T10:00:00Z");
    expect(pdf.length).toBeGreaterThan(without.length);
  });

  it("names the cause in the CSV and the PDF when it is known", async () => {
    const named = { ...report, gaps: [{ fromMs: ms(2), toMs: ms(3, 30), ongoing: false, cause: "unit_offline" as const }] };
    const lines = dayReportCsv(named).split("\r\n");
    expect(lines).toContain('"From","To","Length","Reason"');
    expect(lines).toContain('"22 Oct 2026, 02:00","22 Oct 2026, 03:30","1 h 30 min","Monitoring unit offline"');
    expect((await generateDayReportPdf(named, "2026-10-22T10:00:00Z")).length).toBeGreaterThan((await generateDayReportPdf(report, "2026-10-22T10:00:00Z")).length);
  });

  it("draws the chart in the style chosen in Application Settings", async () => {
    const bars = await generateDayReportPdf(report, "2026-10-22T10:00:00Z", "bar");
    const lines = await generateDayReportPdf(report, "2026-10-22T10:00:00Z", "line");
    expect(bars.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bars.equals(lines)).toBe(false);
  });
});
