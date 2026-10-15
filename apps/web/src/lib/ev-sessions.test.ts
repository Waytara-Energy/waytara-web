import { describe, expect, it } from "vitest";
import { curvePoints, formatSeconds, sessionEnergyKwh, sessionStatusLabel, sourceShares, stopReasonLabel, type EvSampleRow } from "./ev-sessions";

const none = { meter_start_wh: null, meter_stop_wh: null, start_energy_kwh: null, end_energy_kwh: null };

describe("sessionEnergyKwh", () => {
  it("uses the charger's meter when the session came from it", () => {
    expect(sessionEnergyKwh({ ...none, meter_start_wh: 52873, meter_stop_wh: 55373 })).toBe(2.5);
  });
  it("falls back to the energy readings of older sessions", () => {
    expect(sessionEnergyKwh({ ...none, start_energy_kwh: 10, end_energy_kwh: 14.25 })).toBe(4.25);
  });
  it("is unknown while the session is open, and never negative", () => {
    expect(sessionEnergyKwh({ ...none, meter_start_wh: 100 })).toBeNull();
    expect(sessionEnergyKwh({ ...none, meter_start_wh: 5000, meter_stop_wh: 4000 })).toBe(0);
  });
});

describe("sourceShares", () => {
  it("gives each source its share of the total", () => {
    const s = sourceShares({ energy_from_solar_kwh: 1, energy_from_battery_kwh: 0, energy_from_grid_kwh: 3, energy_unattributed_kwh: 0 })!;
    expect(s.map((x) => [x.key, Math.round(x.pct)])).toEqual([["solar", 25], ["battery", 0], ["grid", 75]]);
  });
  it("shows the part with no site figures as 'not known' only when there is some", () => {
    const s = sourceShares({ energy_from_solar_kwh: 2, energy_from_battery_kwh: 0, energy_from_grid_kwh: 0, energy_unattributed_kwh: 2 })!;
    expect(s.find((x) => x.key === "unattributed")?.pct).toBe(50);
  });
  it("says nothing when the site's figures were never available", () => {
    expect(sourceShares({ energy_from_solar_kwh: null, energy_from_battery_kwh: null, energy_from_grid_kwh: null, energy_unattributed_kwh: 1.5 })).toBeNull();
    expect(sourceShares({ energy_from_solar_kwh: 0, energy_from_battery_kwh: 0, energy_from_grid_kwh: 0, energy_unattributed_kwh: 0 })).toBeNull();
  });
});

describe("curvePoints", () => {
  const row = (ts: string, kw: number | null, split?: [number, number, number]): EvSampleRow => ({
    ts, energy_kwh: null, power_kw: kw, current_a_l1: null, voltage_v_l1: null, soc_pct: null,
    ev_from_solar_w: split?.[0] ?? null, ev_from_battery_w: split?.[1] ?? null, ev_from_grid_w: split?.[2] ?? null,
  });
  it("orders by time, turns watts into kW and skips rows without power", () => {
    const p = curvePoints([row("2026-10-15T10:00:30Z", 7, [1000, 0, 6000]), row("2026-10-15T10:00:00Z", 6.5), row("2026-10-15T10:01:00Z", null)]);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ kw: 6.5, solar: null, grid: null });
    expect(p[1]).toMatchObject({ kw: 7, solar: 1, battery: 0, grid: 6 });
    expect(p[0].t).toBeLessThan(p[1].t);
  });
});

describe("labels", () => {
  it("names the statuses and the reasons a charger gives", () => {
    expect(sessionStatusLabel("active")).toEqual({ label: "Charging now", tone: "good" });
    expect(sessionStatusLabel("suspect").tone).toBe("warn");
    expect(stopReasonLabel("EVDisconnected")).toBe("Car unplugged");
    expect(stopReasonLabel("Weird")).toBe("Weird");
    expect(stopReasonLabel(null)).toBeNull();
  });
  it("formats durations", () => {
    expect(formatSeconds(40)).toBe("40s");
    expect(formatSeconds(720)).toBe("12m");
    expect(formatSeconds(3900)).toBe("1h 05m");
    expect(formatSeconds(null)).toBe("—");
  });
});
