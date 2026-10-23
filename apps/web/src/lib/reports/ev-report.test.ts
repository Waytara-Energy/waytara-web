import { describe, expect, it } from "vitest";
import type { EvPerfSession } from "@/lib/ev-perf-stats";
import { buildEvReport, evReportCsv, evSummaryFigures, istStamp, EV_CSV_HEADER, type EvReportInput } from "./ev-report";

const session = (o: Partial<EvPerfSession>): EvPerfSession => ({
  id: "s",
  started_at: "2026-10-20T04:00:00Z",
  ended_at: "2026-10-20T05:00:00Z",
  status: "completed",
  source: "ocpp",
  is_test: false,
  stop_reason: "Local",
  start_energy_kwh: null,
  end_energy_kwh: null,
  meter_start_wh: 1000,
  meter_stop_wh: 6000,
  peak_power_kw: 7,
  avg_power_kw: 5,
  charging_seconds: 3000,
  energy_from_solar_kwh: 3,
  energy_from_battery_kwh: 0,
  energy_from_grid_kwh: 2,
  energy_unattributed_kwh: 0,
  solar_share_pct: 60,
  ...o,
});

const input = (sessions: EvPerfSession[], tariffRate: number | null = 8): EvReportInput => ({
  customerName: 'Asha "A" Rao',
  siteName: "Home",
  deviceLabel: "Charger 1",
  generatedAt: "2026-10-24T05:00:00Z",
  from: "2026-10-19",
  to: "2026-10-25",
  tariffRate,
  tariffNote: "Tamil Nadu residential tariff",
  sessions,
});

describe("buildEvReport", () => {
  it("counts the days of the period and the sessions inside it", () => {
    const r = buildEvReport(input([session({ id: "a" }), session({ id: "old", started_at: "2026-09-01T04:00:00Z" }), session({ id: "t", is_test: true })]));
    expect(r.days).toBe(7);
    expect(r.stats.sessions).toBe(1);
    expect(r.stats.energyKwh).toBeCloseTo(5, 5);
  });
});

describe("istStamp", () => {
  it("shows India time and nothing for a missing or bad time", () => {
    expect(istStamp("2026-10-20T04:00:00Z")).toBe("2026-10-20 09:30");
    expect(istStamp(null)).toBe("");
    expect(istStamp("nonsense")).toBe("");
  });
});

describe("evReportCsv", () => {
  it("lists the sessions oldest first, then the totals and the cost", () => {
    const r = buildEvReport(input([session({ id: "b", started_at: "2026-10-22T04:00:00Z", ended_at: "2026-10-22T05:00:00Z" }), session({ id: "a" })]));
    const lines = evReportCsv(r).split("\r\n");
    expect(lines[0]).toBe(EV_CSV_HEADER.map((h) => `"${h}"`).join(","));
    expect(lines[1]!.startsWith('"2026-10-20 09:30"')).toBe(true);
    expect(lines[2]!.startsWith('"2026-10-22 09:30"')).toBe(true);
    expect(lines[3]).toBe('"Total","","10.00","100","7.0","5.0","60","2 sessions",""');
    expect(lines.slice(4)).toEqual([
      '"Estimated at Rs. 8.00 per kWh","","","","","","","",""',
      '"Paid to the grid, Rs.","","32.00"',
      '"Saved by solar and battery, Rs.","","48.00"',
      '"If all from the grid, Rs.","","80.00"',
    ]);
  });

  it("has the header and a zero total for an empty period, and no cost lines without a tariff", () => {
    const r = buildEvReport(input([], null));
    const lines = evReportCsv(r).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"Total","","0.00","0","","","","0 sessions",""');
  });

  it("quotes cells that hold quotes", () => {
    const r = buildEvReport(input([session({ stop_reason: 'He said "stop"' })]));
    expect(evReportCsv(r)).toContain('"He said ""stop"""');
  });
});

describe("evSummaryFigures", () => {
  it("gives dashes for what is unknown and adds the cost figures only with a tariff", () => {
    const empty = evSummaryFigures(buildEvReport(input([], null)));
    expect(empty.map((f) => f.label)).toEqual(["Charging sessions", "Energy delivered", "Average per session", "Charging time", "Peak power", "Solar share"]);
    expect(empty.find((f) => f.label === "Peak power")!.value).toBe("-");
    expect(empty.find((f) => f.label === "Charging sessions")!.value).toBe("0");

    const priced = evSummaryFigures(buildEvReport(input([session({})])));
    expect(priced.at(-2)).toEqual({ label: "Paid to the grid", value: "Rs. 16" });
    expect(priced.at(-1)).toEqual({ label: "Saved by solar and battery", value: "Rs. 24" });
  });
});
