import { describe, expect, it } from "vitest";
import { evSessionsCsv, EV_SESSIONS_CSV_HEADER, type CsvSession } from "./ev-sessions-csv";
import { evCostEstimate, evTotals } from "./ev-session-totals";
import { periodQuery, resolveEvPeriod } from "./ev-period";
import type { EvSessionRow } from "./ev-sessions";

// 2026-10-23 12:00 IST
const NOW = Date.parse("2026-10-23T06:30:00Z");

describe("the period of the Charging sessions page", () => {
  it("is today by default, in India days", () => {
    const p = resolveEvPeriod({}, NOW);
    expect(p).toMatchObject({ key: "today", from: "2026-10-23", to: "2026-10-23", label: "Today" });
    expect(p.fromIso).toBe("2026-10-22T18:30:00.000Z");
    expect(p.toIso).toBe("2026-10-23T18:30:00.000Z");
  });

  it("counts the day in India time even when it is still yesterday in UTC", () => {
    expect(resolveEvPeriod({}, Date.parse("2026-10-23T19:00:00Z")).from).toBe("2026-10-24");
  });

  it("knows the last 7 and 30 days, today included", () => {
    expect(resolveEvPeriod({ period: "7d" }, NOW)).toMatchObject({ key: "7d", from: "2026-10-17", to: "2026-10-23" });
    expect(resolveEvPeriod({ period: "30d" }, NOW)).toMatchObject({ key: "30d", from: "2026-09-24", to: "2026-10-23" });
  });

  it("takes two typed dates, and falls back to today for anything unusable", () => {
    const c = resolveEvPeriod({ period: "custom", from: "2026-10-01", to: "2026-10-05" }, NOW);
    expect(c).toMatchObject({ key: "custom", from: "2026-10-01", to: "2026-10-05" });
    expect(c.toIso).toBe("2026-10-05T18:30:00.000Z");
    for (const bad of [
      { period: "custom", from: "2026-10-05", to: "2026-10-01" },
      { period: "custom", from: "2026-13-01", to: "2026-13-02" },
      { period: "custom", from: "x", to: "y" },
      { period: "custom", from: "2024-01-01", to: "2026-10-01" },
      { period: "custom" },
      { period: "nonsense" },
    ])
      expect(resolveEvPeriod(bad, NOW).key).toBe("today");
  });

  it("writes the period back into an address", () => {
    expect(periodQuery(resolveEvPeriod({ period: "7d" }, NOW))).toBe("period=7d");
    expect(periodQuery(resolveEvPeriod({ period: "custom", from: "2026-10-01", to: "2026-10-05" }, NOW))).toBe("period=custom&from=2026-10-01&to=2026-10-05");
  });
});

const session = (o: Partial<EvSessionRow>): EvSessionRow => ({
  id: "s",
  equipment_id: "e",
  started_at: "2026-10-23T03:40:00Z",
  ended_at: "2026-10-23T04:31:00Z",
  status: "completed",
  source: "ocpp",
  stop_reason: "Local",
  start_energy_kwh: null,
  end_energy_kwh: null,
  meter_start_wh: 52874,
  meter_stop_wh: 58674,
  peak_power_kw: 6.9,
  avg_power_kw: 6.5,
  max_current_a: 30,
  charging_seconds: 3060,
  energy_from_solar_kwh: 4,
  energy_from_battery_kwh: 0.5,
  energy_from_grid_kwh: 1.3,
  energy_unattributed_kwh: null,
  solar_share_pct: 69,
  site_data_coverage_pct: 100,
  target_kwh: null,
  ...o,
});

describe("the totals row", () => {
  it("adds up the energy, the solar share, the grid part and the longest charge", () => {
    const t = evTotals([session({}), session({ meter_start_wh: 0, meter_stop_wh: 1000, energy_from_solar_kwh: 1, energy_from_battery_kwh: 0, energy_from_grid_kwh: 0, charging_seconds: 600 })]);
    expect(t.count).toBe(2);
    expect(t.energyKwh).toBeCloseTo(6.8, 5);
    expect(t.solarPct).toBeCloseTo((5 / 6.8) * 100, 5);
    expect(t.gridKwh).toBeCloseTo(1.3, 5);
    expect(t.longestSeconds).toBe(3060);
  });

  it("has no solar share or grid figure when no session has a split, and no longest while charging", () => {
    const noSplit = { energy_from_solar_kwh: null, energy_from_battery_kwh: null, energy_from_grid_kwh: null };
    const t = evTotals([session(noSplit), session({ ...noSplit, status: "active", charging_seconds: 99999, ended_at: null })]);
    expect(t.solarPct).toBeNull();
    expect(t.gridKwh).toBeNull();
    expect(t.longestSeconds).toBe(3060);
  });

  it("is empty for no sessions", () => {
    expect(evTotals([])).toEqual({ count: 0, energyKwh: 0, solarPct: null, gridKwh: null, longestSeconds: null });
  });

  it("estimates the cost on the grid's part, or on everything when there is no split", () => {
    expect(evCostEstimate(evTotals([session({})]), 8)).toBeCloseTo(1.3 * 8, 5);
    expect(evCostEstimate(evTotals([session({ energy_from_solar_kwh: null, energy_from_battery_kwh: null, energy_from_grid_kwh: null })]), 8)).toBeCloseTo(5.8 * 8, 5);
  });
});

describe("the sessions CSV", () => {
  it("has a header, one row per session in India time, and empty cells for what is not known", () => {
    const rows: CsvSession[] = [session({}), session({ ended_at: null, status: "active", meter_stop_wh: null, charging_seconds: null, peak_power_kw: null, stop_reason: null, solar_share_pct: null, target_kwh: 10 })];
    const lines = evSessionsCsv(rows).split("\r\n");
    expect(lines[0]).toBe(EV_SESSIONS_CSV_HEADER.map((h) => `"${h}"`).join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('"2026-10-23 09:10","2026-10-23 10:01","completed","5.80","51.0","6.90","6.50","30.0","4.00","0.50","1.30","69","","Local"');
    expect(lines[2]!.startsWith('"2026-10-23 09:10","","active","",')).toBe(true);
    expect(lines[2]).toContain('"10.00"');
  });

  it("is only the header for no sessions, and doubles a quote inside a cell", () => {
    expect(evSessionsCsv([]).split("\r\n")).toHaveLength(1);
    expect(evSessionsCsv([session({ stop_reason: 'a "b"' })])).toContain('"a ""b"""');
  });
});
