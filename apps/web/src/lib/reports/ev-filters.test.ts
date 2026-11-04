import { describe, expect, it } from "vitest";
import type { EvPerfSession } from "@/lib/ev-perf-stats";
import { buildEvReport, evChargingDays, evReportCsv, EV_DAILY_CSV_HEADER } from "./ev-report";
import { filterEvSessions, filtersNote, filtersQuery, monthBounds, monthsBetween, NO_EV_FILTERS, parseEvFilters } from "./ev-filters";

const session = (o: Partial<EvPerfSession>): EvPerfSession => ({
  id: "s",
  started_at: "2026-10-20T04:00:00Z", // 09:30 India time
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

const all = [
  session({ id: "morning" }),
  session({ id: "evening", started_at: "2026-10-20T13:00:00Z", status: "aborted" }), // 18:30
  session({ id: "empty", started_at: "2026-10-21T04:00:00Z", meter_start_wh: 1000, meter_stop_wh: 1000, energy_from_solar_kwh: 0, energy_from_grid_kwh: 0 }),
];
const ids = (l: EvPerfSession[]) => l.map((s) => s.id);

describe("filterEvSessions", () => {
  it("keeps everything with no filters", () => {
    expect(ids(filterEvSessions(all, NO_EV_FILTERS))).toEqual(["morning", "evening", "empty"]);
  });
  it("filters by status", () => {
    expect(ids(filterEvSessions(all, { ...NO_EV_FILTERS, status: "aborted" }))).toEqual(["evening"]);
  });
  it("keeps only the charges that delivered energy", () => {
    expect(ids(filterEvSessions(all, { ...NO_EV_FILTERS, withEnergy: true }))).toEqual(["morning", "evening"]);
  });
  it("filters by the hours a charge started in (India time)", () => {
    expect(ids(filterEvSessions(all, { ...NO_EV_FILTERS, fromTime: "18:00", toTime: "22:00" }))).toEqual(["evening"]);
    expect(ids(filterEvSessions(all, { ...NO_EV_FILTERS, fromTime: "00:00", toTime: "23:59" }))).toHaveLength(3);
  });
});

describe("the filters as text", () => {
  it("round-trips through a query string and ignores what is not valid", () => {
    const f = { status: "aborted", withEnergy: true, fromTime: "18:00", toTime: "22:00" };
    const q = new URLSearchParams(filtersQuery(f));
    expect(parseEvFilters((k) => q.get(k))).toEqual(f);
    const bad = new URLSearchParams("status=%3Cb%3E&fromTime=25:00&toTime=nope");
    expect(parseEvFilters((k) => bad.get(k))).toEqual(NO_EV_FILTERS);
    expect(filtersQuery(NO_EV_FILTERS)).toBe("");
  });
  it("says what is filtered in words", () => {
    expect(filtersNote(NO_EV_FILTERS)).toEqual([]);
    expect(filtersNote({ status: "aborted", withEnergy: true, fromTime: "18:00", toTime: "22:00" })).toEqual(["Status: Ended early", "Only charges that delivered energy", "Started between 18:00 and 22:00"]);
  });
});

describe("months", () => {
  it("bounds a month, never past today", () => {
    expect(monthBounds("2026-10", "2026-11-04")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthBounds("2026-11", "2026-11-04")).toEqual({ from: "2026-11-01", to: "2026-11-04" });
  });
  it("lists the months from the first charge to today, newest first", () => {
    expect(monthsBetween("2026-09-12", "2026-11-04")).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(monthsBetween(null, "2026-11-04")).toEqual(["2026-11"]);
  });
});

describe("the report with filters", () => {
  const report = (filters = NO_EV_FILTERS) =>
    buildEvReport({ customerName: "A", siteName: null, deviceLabel: "C", generatedAt: "", from: "2026-10-19", to: "2026-10-25", tariffRate: 8, tariffNote: "", sessions: all, filters });

  it("works out its figures from the filtered sessions", () => {
    expect(report().stats.sessions).toBe(3);
    expect(report({ ...NO_EV_FILTERS, status: "aborted" }).stats.sessions).toBe(1);
  });
  it("has a row for each day, with the sources, and counts days with a charge", () => {
    const r = report();
    expect(r.stats.dayFigures).toHaveLength(7);
    expect(evChargingDays(r).map((d) => d.date)).toEqual(["2026-10-20", "2026-10-21"]);
    const d20 = r.stats.dayFigures.find((d) => d.date === "2026-10-20")!;
    expect(d20.sessions).toBe(2);
    expect(d20.energyKwh).toBeCloseTo(10);
    expect(d20.solarKwh).toBeCloseTo(6);
    expect(d20.gridKwh).toBeCloseTo(4);
    expect(d20.saved).toBeCloseTo(48);
  });
  it("writes the daily and statement CSV", () => {
    const daily = evReportCsv(report(), "daily").split("\r\n");
    expect(daily[0]).toBe(EV_DAILY_CSV_HEADER.map((h) => `"${h}"`).join(","));
    expect(daily).toHaveLength(1 + 2 + 1);
    expect(daily.at(-1)).toContain('"Total"');
    const statement = evReportCsv(report({ ...NO_EV_FILTERS, status: "completed" }), "statement");
    expect(statement).toContain("EV charging statement");
    expect(statement).toContain("Filter");
    expect(statement).toContain("Paid to the grid, Rs.");
  });
});
