import { describe, expect, it } from "vitest";
import { buildSessionDetail, eventLine, sampleGaps } from "./ev-session-detail";

const base = {
  id: "s1",
  equipment_id: "e1",
  status: "completed",
  source: "ocpp",
  is_test: false,
  stop_reason: "Remote",
  ocpp_transaction_id: 1010,
  start_energy_kwh: 0,
  end_energy_kwh: 0.426,
  meter_start_wh: 0,
  meter_stop_wh: 426,
  peak_power_kw: 7.002,
  avg_power_kw: 6.31,
  max_current_a: 30.07,
  charging_seconds: 213,
  energy_from_solar_kwh: 0.025,
  energy_from_battery_kwh: 0.194,
  energy_from_grid_kwh: 0.207,
  energy_unattributed_kwh: 0,
  solar_share_pct: 5.9,
  site_data_coverage_pct: 100,
  target_kwh: null,
  cost_amount: null,
  started_at: "2026-11-03T10:50:03Z",
  ended_at: "2026-11-03T10:54:06Z",
};

const sample = (t: string, kwh: number, kw: number, extra: object = {}) => ({
  ts: t,
  energy_kwh: kwh,
  power_kw: kw,
  current_a_l1: 30,
  voltage_v_l1: 233,
  soc_pct: null,
  temperature_c: 38,
  current_offered_a: 32,
  ev_from_solar_w: null,
  ev_from_battery_w: null,
  ev_from_grid_w: null,
  ...extra,
});

describe("buildSessionDetail", () => {
  it("uses the session's own figures when they are written, and prices the energy at the rate", () => {
    const d = buildSessionDetail(base, [sample("2026-11-03T10:50:06Z", 0, 0.005), sample("2026-11-03T10:50:33Z", 0.021, 6.985)], [], 8, Date.parse("2026-11-04T00:00:00Z"));
    expect(d.kwh).toBeCloseTo(0.426, 3);
    expect(d.peakKw).toBe(7.002);
    expect(d.chargingS).toBe(213);
    expect(d.cost).toBeCloseTo(0.426 * 8, 3);
    expect(d.savedBySolar).toBeCloseTo(0.025 * 8, 3);
    expect(d.shares?.map((s) => s.key)).toEqual(["solar", "battery", "grid"]);
    expect(d.notes).toEqual([]);
    expect(d.voltage).toEqual({ min: 233, max: 233 });
    expect(d.temperature).toEqual({ min: 38, max: 38 });
  });

  it("works out a charge whose stop report was lost from its samples, and says so", () => {
    // charge 1012 of 3 Nov: no end energy, no summary; a five-minute silence in the middle
    const row = {
      ...base,
      status: "active",
      stop_reason: "Local",
      ocpp_transaction_id: 1012,
      start_energy_kwh: 0.738,
      end_energy_kwh: null,
      meter_start_wh: 738,
      meter_stop_wh: null,
      peak_power_kw: null,
      avg_power_kw: null,
      max_current_a: null,
      charging_seconds: null,
      energy_from_solar_kwh: null,
      energy_from_battery_kwh: null,
      energy_from_grid_kwh: null,
      energy_unattributed_kwh: null,
      site_data_coverage_pct: null,
      target_kwh: 0.2,
      started_at: "2026-11-03T11:00:42Z",
      ended_at: "2026-11-03T11:14:02Z",
    };
    const d = buildSessionDetail(
      row,
      [
        sample("2026-11-03T11:00:45Z", 0.738, 0.005),
        sample("2026-11-03T11:01:13Z", 0.76, 6.992, { ev_from_grid_w: 6992 }),
        sample("2026-11-03T11:06:31Z", 1.377, 6.993),
        sample("2026-11-03T11:06:34Z", 1.377, 6.994),
      ],
      [],
      8,
      Date.parse("2026-11-04T00:00:00Z"),
    );
    expect(d.status).toEqual({ label: "Closed automatically", tone: "warn" });
    expect(d.stopReason).toBeNull();
    expect(d.kwh).toBeCloseTo(0.639, 3);
    expect(d.bookedKwh).toBe(0.2);
    expect(d.peakKw).toBe(6.994);
    // the car was charging through the silence: 0.617 kWh arrived in it at about 7 kW, plus the readings either side
    expect(d.chargingS).toBeGreaterThan(330);
    expect(d.chargingS).toBeLessThan(360);
    expect(d.endedAt).toBe("2026-11-03T11:06:34.000Z");
    // it ends where the last reading was, not where WayTara gave up
    expect(d.spanS).toBe(352);
    expect(d.gaps).toHaveLength(1);
    expect(d.gaps[0].seconds).toBe(318);
    expect(d.notes.length).toBeGreaterThanOrEqual(3);
    // the split of the one sample that had one is added up (never guessed for the silent minutes)
    expect(d.shares?.find((s) => s.key === "grid")?.kwh).toBeGreaterThan(0);
  });

  it("keeps only the events around the charge", () => {
    const events = [
      { ts: "2026-11-03T10:40:00Z", kind: "boot", detail: {} },
      { ts: "2026-11-03T10:49:51Z", kind: "status", detail: { status: "Preparing" } },
      { ts: "2026-11-03T10:54:10Z", kind: "transaction_stop", detail: { reason: "Remote", energy_kwh: 0.426 } },
      { ts: "2026-11-03T12:00:00Z", kind: "connected", detail: {} },
    ];
    const d = buildSessionDetail(base, [], events, 8, 0);
    expect(d.events.map((e) => e.label)).toEqual(["Connector: Preparing", "Charge ended"]);
    expect(d.events[1].note).toBe("Stopped from the app · 0.426 kWh delivered");
  });
});

describe("eventLine and sampleGaps", () => {
  it("shows an unknown event by its name and flags a connector fault", () => {
    expect(eventLine({ ts: "t", kind: "firmware_update", detail: null }).label).toBe("firmware update");
    expect(eventLine({ ts: "t", kind: "status", detail: { status: "Faulted", error: "GroundFailure" } })).toMatchObject({ tone: "warn", note: "error GroundFailure" });
  });
  it("finds silences longer than a little over three sample intervals", () => {
    const t = (s: number) => s * 1000;
    expect(sampleGaps([t(0), t(30), t(60), t(150)])).toHaveLength(0);
    expect(sampleGaps([t(0), t(30), t(200)])).toEqual([{ from: new Date(30000).toISOString(), to: new Date(200000).toISOString(), seconds: 170 }]);
  });
});
