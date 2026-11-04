// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildEvReport } from "./ev-report";
import { generateEvReportPdf } from "./ev-report-pdf";

describe("generateEvReportPdf", () => {
  it("draws a PDF for an empty period", async () => {
    const r = buildEvReport({ customerName: "A", siteName: null, deviceLabel: null, generatedAt: "2026-10-24T05:00:00Z", from: "2026-10-19", to: "2026-10-25", tariffRate: null, tariffNote: "", sessions: [] });
    const pdf = await generateEvReportPdf(r);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30000);

  it("draws the day-by-day and the statement forms too", async () => {
    const r = buildEvReport({ customerName: "A", siteName: null, deviceLabel: null, generatedAt: "2026-10-24T05:00:00Z", from: "2026-10-19", to: "2026-10-25", tariffRate: 8, tariffNote: "", sessions: [], filters: { status: "completed", withEnergy: true, fromTime: "18:00", toTime: "22:00" } });
    for (const mode of ["daily", "statement"] as const) {
      const pdf = await generateEvReportPdf(r, mode);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 30000);
});
