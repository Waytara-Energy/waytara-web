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
});
