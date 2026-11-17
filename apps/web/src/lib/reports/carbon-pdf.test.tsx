// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { DayEnergy } from "@/lib/savings";
import { buildCarbonPack } from "./carbon-data";
import { generateCarbonPdf } from "./carbon-pdf";

const day = (n: number): DayEnergy => ({ day: new Date(Date.UTC(2026, 3, 1 + n)).toISOString().slice(0, 10), pvKwh: 20 + (n % 7), loadKwh: 15, importKwh: 4 + (n % 3), exportKwh: 6 });
const base = {
  customerName: "Asha Rao",
  siteName: "Home",
  deviceLabel: "Inverter",
  deviceId: "3f9a1c00-0000-0000-0000-000000000000",
  generatedAt: "2026-10-09T10:00:00Z",
  today: "2026-10-09",
  days: Array.from({ length: 160 }, (_, i) => day(i)),
  lifetime: { loadKwh: 900, importKwh: 300, exportKwh: 100, pvKwh: 1155 },
  co2KgPerKwh: 0.71,
  co2Note: "0.71 kg CO2/kWh - CEA CO2 Baseline Database v21.0, weighted average, 2024-25, provisional",
};

describe("generateCarbonPdf", () => {
  it("draws a PDF for a financial year so far, and for all the history", async () => {
    for (const id of ["fy-2026", "all"]) {
      const pack = buildCarbonPack(base, id)!;
      const pdf = await generateCarbonPdf(pack);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(3000);
    }
  }, 60000);

  it("draws a PDF for a period with few readings and no lifetime counter", async () => {
    const pack = buildCarbonPack({ ...base, days: base.days.slice(0, 3), lifetime: null }, "fy-2026")!;
    expect((await generateCarbonPdf(pack)).subarray(0, 4).toString()).toBe("%PDF");
  }, 60000);
});
