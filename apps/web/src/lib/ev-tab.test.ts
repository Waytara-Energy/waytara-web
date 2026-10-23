import { describe, expect, it } from "vitest";
import { durationShort, energyOfSessions, evLiveFigures, minutesText, openSession, openTransactionId, sessionFigures, sessionStartKwh, todayChartPoints, type TabSession } from "./ev-tab";
import type { EvSampleRow } from "./ev-sessions";

const row = (o: Partial<TabSession>): TabSession => ({
  id: "s",
  started_at: "2026-10-23T10:00:00Z",
  ended_at: null,
  status: "active",
  ocpp_transaction_id: null,
  peak_power_kw: null,
  solar_share_pct: null,
  charging_seconds: null,
  meter_start_wh: null,
  meter_stop_wh: null,
  start_energy_kwh: null,
  end_energy_kwh: null,
  ...o,
});

describe("the running session", () => {
  it("is the newest one that has not ended, and none when all have", () => {
    const a = row({ id: "a", started_at: "2026-10-23T08:00:00Z" });
    const b = row({ id: "b", started_at: "2026-10-23T09:00:00Z" });
    const c = row({ id: "c", ended_at: "2026-10-23T07:00:00Z" });
    expect(openSession([a, b, c])?.id).toBe("b");
    expect(openSession([c])).toBeNull();
    expect(openSession([])).toBeNull();
  });

  it("gives the transaction number to stop, or null when it is not known or nothing runs", () => {
    expect(openTransactionId([row({ ocpp_transaction_id: 1042 })])).toBe(1042);
    expect(openTransactionId([row({ ocpp_transaction_id: null })])).toBeNull();
    expect(openTransactionId([row({ ended_at: "2026-10-23T11:00:00Z", ocpp_transaction_id: 7 })])).toBeNull();
  });
});

describe("durations and figures", () => {
  it("writes short durations", () => {
    expect(durationShort("2026-10-23T10:00:00Z", "2026-10-23T10:42:00Z")).toBe("42m");
    expect(durationShort("2026-10-23T10:00:00Z", "2026-10-23T11:05:00Z")).toBe("1h 5m");
    expect(durationShort("2026-10-23T10:00:00Z", null, Date.parse("2026-10-23T10:30:00Z"))).toBe("30m");
  });

  it("takes the energy from the charger's meter and sums a day", () => {
    const done = row({ ended_at: "2026-10-23T11:00:00Z", meter_start_wh: 52874, meter_stop_wh: 53724, peak_power_kw: 6.9, solar_share_pct: 40 });
    const f = sessionFigures(done);
    expect(f.energyKwh).toBeCloseTo(0.85, 2);
    expect(f).toMatchObject({ duration: "1h 0m", peakKw: 6.9, solarPct: 40 });
    expect(energyOfSessions([done, row({})])).toBeCloseTo(0.85, 2);
  });

  it("prefers the charging time the server counted", () => {
    expect(sessionFigures(row({ charging_seconds: 3600 })).duration).toBe("1h 00m");
  });
});

describe("the live tiles", () => {
  const base = { kw: 6.9, registerKwh: 105.2, startKwh: 102, ratedKw: 7.4, targetKwh: 10, startedAt: "2026-10-23T08:30:00Z", charging: true, now: Date.parse("2026-10-23T08:58:00Z") };

  it("works out this charge, its progress, the time and what is left", () => {
    const f = evLiveFigures(base);
    expect(f.powerPct).toBeCloseTo(93.2, 0);
    expect(f.sessionKwh).toBeCloseTo(3.2, 5);
    expect(f.progressPct).toBeCloseTo(32, 5);
    expect(f.elapsedMin).toBe(28);
    expect(f.remainingMin).toBe(59);
  });

  it("shows nothing for a charger that is not charging", () => {
    expect(evLiveFigures({ ...base, charging: false })).toEqual({ powerPct: null, sessionKwh: null, progressPct: null, elapsedMin: null, remainingMin: null });
  });

  it("has no progress without a target and no estimate without power", () => {
    expect(evLiveFigures({ ...base, targetKwh: null }).progressPct).toBeNull();
    expect(evLiveFigures({ ...base, targetKwh: null }).remainingMin).toBeNull();
    expect(evLiveFigures({ ...base, kw: 0 }).remainingMin).toBeNull();
    expect(evLiveFigures({ ...base, registerKwh: null }).sessionKwh).toBeNull();
  });

  it("never goes below zero or above a hundred", () => {
    expect(evLiveFigures({ ...base, registerKwh: 90 }).sessionKwh).toBe(0);
    expect(evLiveFigures({ ...base, registerKwh: 130 }).progressPct).toBe(100);
    expect(evLiveFigures({ ...base, kw: 12 }).powerPct).toBe(100);
  });

  it("takes the start count from the charger meter, else the older reading", () => {
    expect(sessionStartKwh({ meter_start_wh: 52874, start_energy_kwh: 1 })).toBeCloseTo(52.874, 5);
    expect(sessionStartKwh({ meter_start_wh: null, start_energy_kwh: 12.5 })).toBe(12.5);
    expect(sessionStartKwh({ meter_start_wh: null, start_energy_kwh: null })).toBeNull();
  });

  it("writes minutes the way people say them", () => {
    expect(minutesText(58)).toBe("58 min");
    expect(minutesText(65)).toBe("1 h 05 min");
  });
});

describe("today power chart", () => {
  const sample = (ts: string, kw: number): EvSampleRow => ({ ts, energy_kwh: null, power_kw: kw, current_a_l1: null, voltage_v_l1: null, soc_pct: null, ev_from_solar_w: kw * 600, ev_from_battery_w: 0, ev_from_grid_w: kw * 400 });

  it("puts every session samples in time order and breaks the line between sessions", () => {
    const morning = [sample("2026-10-23T03:00:00Z", 6), sample("2026-10-23T03:30:00Z", 7)];
    const noon = [sample("2026-10-23T06:00:00Z", 5)];
    const pts = todayChartPoints([noon, morning]);
    expect(pts.map((p) => p.kw)).toEqual([6, 7, null, 5]);
    expect(pts[0].solar).toBeCloseTo(3.6, 5);
    expect(pts[2].t).toBe(Date.parse("2026-10-23T03:30:00Z") + 1000);
  });

  it("is empty when nothing was sampled", () => {
    expect(todayChartPoints([])).toEqual([]);
    expect(todayChartPoints([[]])).toEqual([]);
  });
});
