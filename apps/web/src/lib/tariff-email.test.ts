import { describe, expect, it } from "vitest";
import { buildTariffEmail } from "./tariff-email";

const base = { customerName: "Asha", state: "Tamil Nadu", category: "residential" as const, oldRate: 8, newRate: 8.4, effectiveFrom: "2026-07-01", siteNames: ["Waytara Office"], dashboardUrl: "https://www.waytaraenergy.com/dashboard/performance" };

describe("buildTariffEmail", () => {
  it("says what changed, from when, and what it means for the savings page", () => {
    const e = buildTariffEmail(base);
    expect(e.subject).toBe("Electricity rate up in Tamil Nadu: your savings now use ₹8.40/kWh");
    expect(e.text).toContain("Hi Asha,");
    expect(e.text).toContain("from ₹8.00 to ₹8.40 per kWh from 1 Jul 2026");
    expect(e.text).toContain("Waytara Office");
    expect(e.text).toContain("earlier months keep the rate they had");
    expect(e.text).toContain(base.dashboardUrl);
    expect(e.html).toContain(base.dashboardUrl);
  });
  it("says down when the rate falls, and greets an unnamed customer", () => {
    const e = buildTariffEmail({ ...base, oldRate: 9, newRate: 8.5, customerName: null });
    expect(e.subject).toContain("down in Tamil Nadu");
    expect(e.text).toContain("Hi there,");
  });
  it("escapes what it puts in the HTML", () => {
    expect(buildTariffEmail({ ...base, state: "<b>x</b>" }).html).not.toContain("<b>x</b>");
  });
});
