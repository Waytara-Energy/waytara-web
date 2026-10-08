import { describe, expect, it } from "vitest";
import { categoryForPropertyType, matchState, resolveTariff, type TariffRow } from "./tariff";

const row = (over: Partial<TariffRow> = {}): TariffRow => ({
  state: "Tamil Nadu",
  category: "residential",
  rate_per_kwh: 8,
  export_rate_per_kwh: null,
  fixed_charge_per_month: null,
  effective_from: "2025-07-01",
  source_url: "https://example.org/order",
  source_note: null,
  confidence: "indicative",
  ...over,
});
const input = (rows: TariffRow[], over: Partial<Parameters<typeof resolveTariff>[0]> = {}) => ({ rows, state: "Tamil Nadu", propertyType: "residential_independent_villas", accountRate: 7, today: "2026-10-08", ...over });

describe("categoryForPropertyType", () => {
  it("bills homes as residential, offices and similar as commercial, factories as industrial", () => {
    expect(categoryForPropertyType("residential_independent_villas")).toBe("residential");
    expect(categoryForPropertyType("gated_communities_rwas_high_rises")).toBe("residential");
    expect(categoryForPropertyType("corporate_offices_hospitals_hotels_retail")).toBe("commercial");
    expect(categoryForPropertyType("tech_parks_data_centers_rnd_hubs")).toBe("commercial");
    expect(categoryForPropertyType("logistics_delivery_hubs_bus_depots")).toBe("commercial");
    expect(categoryForPropertyType("factories_heavy_engineering_processing_plants")).toBe("industrial");
    expect(categoryForPropertyType(null)).toBe("residential");
  });
});

describe("matchState", () => {
  it("recognises how a state is written in an address", () => {
    expect(matchState("Tamil Nadu")).toBe("Tamil Nadu");
    expect(matchState("tamilnadu")).toBe("Tamil Nadu");
    expect(matchState(" TAMIL NADU ")).toBe("Tamil Nadu");
    expect(matchState("Orissa")).toBe("Odisha");
    expect(matchState("Jammu & Kashmir")).toBe("Jammu and Kashmir");
    expect(matchState("NCT of Delhi")).toBe("Delhi");
  });
  it("is null for something that is not a state", () => {
    expect(matchState("Narnia")).toBeNull();
    expect(matchState("")).toBeNull();
    expect(matchState(undefined)).toBeNull();
  });
});

describe("resolveTariff", () => {
  it("uses the state's rate for the site's kind of property", () => {
    const t = resolveTariff(input([row(), row({ category: "commercial", rate_per_kwh: 9 })]));
    expect(t).toMatchObject({ rate: 8, exportRate: 8, source: "state", state: "Tamil Nadu", category: "residential", confidence: "indicative", effectiveFrom: "2025-07-01" });
    expect(resolveTariff(input([row(), row({ category: "commercial", rate_per_kwh: 9 })], { propertyType: "corporate_offices_hospitals_hotels_retail" })).rate).toBe(9);
  });

  it("uses the export rate when there is one, else the same rate", () => {
    expect(resolveTariff(input([row({ export_rate_per_kwh: 3 })])).exportRate).toBe(3);
    expect(resolveTariff(input([row({ export_rate_per_kwh: 0 })])).exportRate).toBe(0);
  });

  it("falls back to the customer's own rate when no rate is on file for the state, and says so", () => {
    const t = resolveTariff(input([row({ state: "Kerala" })]));
    expect(t).toMatchObject({ rate: 7, source: "account", confidence: "account", effectiveFrom: null });
    expect(resolveTariff(input([row()], { state: null })).source).toBe("account");
  });

  it("uses the newest rate that has started, and ignores one still to come", () => {
    const rows = [row({ rate_per_kwh: 8, effective_from: "2025-07-01" }), row({ rate_per_kwh: 8.5, effective_from: "2026-07-01" }), row({ rate_per_kwh: 9, effective_from: "2027-01-01" })];
    expect(resolveTariff(input(rows)).rate).toBe(8.5);
    expect(resolveTariff(input(rows, { today: "2026-06-30" })).rate).toBe(8);
  });

  it("reports a recent change with what it changed from, for 30 days", () => {
    const rows = [row({ rate_per_kwh: 8, effective_from: "2025-07-01" }), row({ rate_per_kwh: 8.5, effective_from: "2026-10-01" })];
    const t = resolveTariff(input(rows));
    expect(t.previous).toEqual({ rate: 8, effectiveFrom: "2025-07-01" });
    expect(t.changedRecently).toBe(true);
    expect(resolveTariff(input(rows, { today: "2026-11-15" })).changedRecently).toBe(false);
  });

  it("does not call a re-confirmed rate a change", () => {
    const rows = [row({ rate_per_kwh: 8, effective_from: "2025-07-01" }), row({ rate_per_kwh: 8, effective_from: "2026-10-01", confidence: "verified" })];
    const t = resolveTariff(input(rows));
    expect(t.previous).toBeNull();
    expect(t.changedRecently).toBe(false);
    expect(t.confidence).toBe("verified");
  });

  it("keeps the rates that have started, oldest first, so a past month can be priced at its own rate", () => {
    const rows = [row({ rate_per_kwh: 8.5, effective_from: "2026-07-01" }), row({ rate_per_kwh: 8, effective_from: "2025-07-01" }), row({ rate_per_kwh: 9, effective_from: "2027-01-01" })];
    expect(resolveTariff(input(rows)).timeline.map((t) => [t.effectiveFrom, t.rate, t.exportRate])).toEqual([
      ["2025-07-01", 8, 8],
      ["2026-07-01", 8.5, 8.5],
    ]);
    expect(resolveTariff(input([row({ state: "Kerala" })])).timeline).toEqual([]);
  });

  it("announces a scheduled change within 30 days", () => {
    const rows = [row({ rate_per_kwh: 8 }), row({ rate_per_kwh: 8.4, effective_from: "2026-10-25" }), row({ rate_per_kwh: 9, effective_from: "2027-06-01" })];
    expect(resolveTariff(input(rows)).upcoming).toEqual({ rate: 8.4, effectiveFrom: "2026-10-25" });
    expect(resolveTariff(input([row(), row({ rate_per_kwh: 9, effective_from: "2027-06-01" })])).upcoming).toBeNull();
  });
});

describe("a banded tariff", () => {
  const tn = row({
    rate_per_kwh: 5.55,
    slabs: [{ upTo: 400, rate: 4.95 }, { upTo: null, rate: 6.65 }],
    billing_months: 2,
    duty_pct: 5,
    free_units: 200,
    free_units_cap: 500,
    free_units_over_cap: 100,
    effective_from: "2026-05-10",
  });

  it("carries the bands, free units and duty, and nets export against import when no export rate is set", () => {
    const t = resolveTariff(input([tn]));
    expect(t.schedule).toMatchObject({ billingMonths: 2, dutyPct: 5, freeUnits: 200, freeUnitsCap: 500, freeUnitsOverCap: 100 });
    expect(t.schedule.slabs).toHaveLength(2);
    expect(t.netMetering).toBe(true);
    expect(t.timeline[0].netMetering).toBe(true);
  });

  it("pays export at the export rate when one is set", () => {
    const t = resolveTariff(input([{ ...tn, export_rate_per_kwh: 3 }]));
    expect(t.netMetering).toBe(false);
    expect(t.exportRate).toBe(3);
  });

  it("treats a plain single rate as a flat tariff, and the account rate as one too", () => {
    const flat = resolveTariff(input([row()]));
    expect(flat.netMetering).toBe(false);
    expect(flat.schedule.slabs).toEqual([{ upTo: null, rate: 8 }]);
    const account = resolveTariff(input([row({ state: "Kerala" })]));
    expect(account.schedule.slabs).toEqual([{ upTo: null, rate: 7 }]);
  });
});
