import { describe, expect, it } from "vitest";
import { chargingShareOfLoadPct, evPerfStats, loadKwhInSpan, spanDays, spanOfDays, type EvPerfSession } from "./ev-perf-stats";

const base: EvPerfSession = {
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
};
const make = (o: Partial<EvPerfSession>): EvPerfSession => ({ ...base, ...o });
const week = spanOfDays("2026-10-19", "2026-10-25");

describe("the span", () => {
  it("lists every India day, both ends included", () => {
    expect(spanDays(week)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(spanDays(spanOfDays("2026-10-23", "2026-10-23"))).toEqual(["2026-10-23"]);
  });
});

describe("evPerfStats", () => {
  it("adds up the sessions of the period", () => {
    const s = evPerfStats(
      [
        make({ id: "a" }),
        make({ id: "b", started_at: "2026-10-22T04:00:00Z", meter_start_wh: 6000, meter_stop_wh: 9000, peak_power_kw: 7.2, avg_power_kw: 6, energy_from_solar_kwh: 1, energy_from_grid_kwh: 2, solar_share_pct: 33, charging_seconds: 1800 }),
      ],
      week,
    );
    expect(s.sessions).toBe(2);
    expect(s.energyKwh).toBeCloseTo(8, 5);
    expect(s.avgSessionKwh).toBeCloseTo(4, 5);
    expect(s.peakKw).toBe(7.2);
    expect(s.chargingSeconds).toBe(4800);
    // weighted by energy: (5*5 + 6*3) / 8
    expect(s.avgKw).toBeCloseTo(5.375, 5);
    expect(s.sources).toMatchObject({ solarKwh: 4, gridKwh: 4 });
    expect(s.solarSharePct).toBeCloseTo(50, 5);
    expect(s.rows.map((r) => r.id)).toEqual(["b", "a"]); // newest first
  });

  it("puts each session's energy on the India day it started and gives every day of the period a value", () => {
    // 2026-10-20 23:30 UTC is 05:00 IST on the 21st
    const s = evPerfStats([make({ id: "a", started_at: "2026-10-20T23:30:00Z" })], week);
    const day = (d: string) => s.daily.find((x) => x.date === d)?.value;
    expect(s.daily).toHaveLength(7);
    expect(day("2026-10-21")).toBeCloseTo(5, 5);
    expect(day("2026-10-20")).toBe(0);
  });

  it("leaves out sessions outside the period, test sessions and simulator sessions", () => {
    const s = evPerfStats([make({ id: "in" }), make({ id: "old", started_at: "2026-09-01T04:00:00Z" }), make({ id: "test", is_test: true }), make({ id: "sim", source: "simulated" })], week);
    expect(s.rows.map((r) => r.id)).toEqual(["in"]);
  });

  it("shows the sample sessions, labelled, only while the charger has no real one", () => {
    const only = evPerfStats([make({ id: "test", is_test: true }), make({ id: "sim", source: "simulated" })], week);
    expect(only.sample).toBe(true);
    expect(only.rows.map((r) => r.id).sort()).toEqual(["sim", "test"]);
    const mixed = evPerfStats([make({ id: "real" }), make({ id: "test", is_test: true })], week);
    expect(mixed.sample).toBe(false);
    expect(mixed.rows.map((r) => r.id)).toEqual(["real"]);
    expect(evPerfStats([], week).sample).toBe(false);
  });

  it("says nothing it does not know: no sessions, no energy count, no split", () => {
    const empty = evPerfStats([], week);
    expect(empty).toMatchObject({ sessions: 0, energyKwh: 0, avgSessionKwh: null, peakKw: null, avgKw: null, solarSharePct: null, cost: null });
    expect(empty.daily.every((d) => d.value === 0)).toBe(true);

    const unknown = evPerfStats([make({ meter_start_wh: null, meter_stop_wh: null, energy_from_solar_kwh: null, energy_from_battery_kwh: null, energy_from_grid_kwh: null, solar_share_pct: null })], week);
    expect(unknown.sessions).toBe(1);
    expect(unknown.energyKwh).toBe(0);
    expect(unknown.avgSessionKwh).toBeNull();
    expect(unknown.solarSharePct).toBeNull();
    expect(unknown.rows[0]!.energyKwh).toBeNull();
  });

  it("takes the duration from the end time when the charger gave no charging seconds", () => {
    const s = evPerfStats([make({ charging_seconds: null })], week);
    expect(s.rows[0]!.durationS).toBe(3600);
    expect(evPerfStats([make({ charging_seconds: null, ended_at: null })], week).rows[0]!.durationS).toBeNull();
  });

  it("prices the grid part, what solar and battery saved, and what it would all have cost", () => {
    const s = evPerfStats([make({ energy_from_solar_kwh: 3, energy_from_battery_kwh: 0.5, energy_from_grid_kwh: 1.5, energy_unattributed_kwh: 0 })], week, 8);
    expect(s.cost).toEqual({ rate: 8, gridCost: 12, saved: 28, allGridCost: 40 });
  });

  it("counts the energy as grid when no session has a source split", () => {
    const s = evPerfStats([make({ energy_from_solar_kwh: null, energy_from_battery_kwh: null, energy_from_grid_kwh: null })], week, 10);
    expect(s.cost).toEqual({ rate: 10, gridCost: 50, saved: 0, allGridCost: 50 });
  });

  it("has no cost without a tariff", () => {
    expect(evPerfStats([make({})], week, null).cost).toBeNull();
    expect(evPerfStats([make({})], week, 0).cost).toBeNull();
  });
});

describe("the home load", () => {
  it("adds the days of the span only", () => {
    const daily = [
      { ts: "2026-10-18T18:30:00Z", value: 10 }, // the 19th in India
      { ts: "2026-10-19T18:30:00Z", value: 12 },
      { ts: "2026-10-30T18:30:00Z", value: 99 }, // outside
    ];
    expect(loadKwhInSpan(daily, week)).toBe(22);
    expect(loadKwhInSpan([], week)).toBeNull();
  });

  it("gives the charging as a share of it, capped at 100, and nothing when the load is unknown", () => {
    expect(chargingShareOfLoadPct(5, 20)).toBe(25);
    expect(chargingShareOfLoadPct(30, 20)).toBe(100);
    expect(chargingShareOfLoadPct(5, null)).toBeNull();
    expect(chargingShareOfLoadPct(5, 0)).toBeNull();
  });
});
