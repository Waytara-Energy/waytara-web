import { describe, expect, it } from "vitest";
import type { EvPerfSession } from "./ev-perf-stats";
import { evPerfStats, spanOfDays } from "./ev-perf-stats";
import { CLOSED_AUTO, isClosedWithoutReport, recoverSession, type RecoverySample } from "./ev-recover";
import { sessionStatusLabel } from "./ev-sessions";

// Charge 1012 of 3 Nov: started 16:30 IST at register 738 Wh, 0.2 kWh booked; the connection dropped, the charger ran on to 1377 Wh, and the stop
// report was lost, so WayTara closed it at 16:44 without an end reading.
const stuck: EvPerfSession = {
  id: "s1012",
  started_at: "2026-11-03T11:00:42Z",
  ended_at: "2026-11-03T11:14:02Z",
  status: "active",
  source: "ocpp",
  is_test: false,
  stop_reason: "Local",
  start_energy_kwh: null,
  end_energy_kwh: null,
  meter_start_wh: 738,
  meter_stop_wh: null,
  peak_power_kw: null,
  avg_power_kw: null,
  charging_seconds: null,
  energy_from_solar_kwh: null,
  energy_from_battery_kwh: null,
  energy_from_grid_kwh: null,
  energy_unattributed_kwh: null,
  solar_share_pct: null,
};
const sample = (ts: string, kwh: number, kw: number, grid: number | null): RecoverySample => ({ ts, energy_kwh: kwh, power_kw: kw, current_a_l1: 30, voltage_v_l1: 235, soc_pct: null, ev_from_solar_w: grid === null ? null : 0, ev_from_battery_w: grid === null ? null : 0, ev_from_grid_w: grid });
const samples = [sample("2026-11-03T11:01:00Z", 0.75, 7.0, 7000), sample("2026-11-03T11:01:30Z", 0.76, 7.0, 7000), sample("2026-11-03T11:06:40Z", 1.377, 7.0, null)];

describe("a charge WayTara closed by itself", () => {
  it("is told apart: an end time but still marked active", () => {
    expect(isClosedWithoutReport(stuck)).toBe(true);
    expect(isClosedWithoutReport({ ...stuck, ended_at: null })).toBe(false);
    expect(isClosedWithoutReport({ ...stuck, status: "completed" })).toBe(false);
  });

  it("gets its end, energy and peak from the readings it did get", () => {
    const r = recoverSession(stuck, samples, Date.parse("2026-11-04T05:00:00Z"));
    expect(r.status).toBe(CLOSED_AUTO);
    expect(r.ended_at).toBe("2026-11-03T11:06:40.000Z");
    expect(r.meter_stop_wh).toBe(1377);
    expect(r.peak_power_kw).toBe(7);
    expect(r.stop_reason).toBeNull();
  });

  it("is no longer listed as charging, and its energy counts in the figures", () => {
    const r = recoverSession(stuck, samples, Date.parse("2026-11-04T05:00:00Z"));
    const week = spanOfDays("2026-11-01", "2026-11-04");
    const stats = evPerfStats([r], week, 8);
    expect(stats.rows[0]!.status).toBe(CLOSED_AUTO);
    expect(stats.rows[0]!.energyKwh).toBeCloseTo(0.639, 3);
    expect(stats.energyKwh).toBeCloseTo(0.639, 3);
    expect(sessionStatusLabel(CLOSED_AUTO)).toEqual({ label: "Closed automatically", tone: "warn" });
  });

  it("without any readings is still not shown as charging (its energy stays unknown)", () => {
    const r = recoverSession(stuck, [], Date.parse("2026-11-04T05:00:00Z"));
    expect(r.status).toBe(CLOSED_AUTO);
    expect(r.meter_stop_wh).toBeNull();
  });

  it("leaves a session that finished properly alone", () => {
    const done = { ...stuck, status: "completed", meter_stop_wh: 1000 };
    expect(recoverSession(done, samples, 0)).toBe(done);
  });
});
