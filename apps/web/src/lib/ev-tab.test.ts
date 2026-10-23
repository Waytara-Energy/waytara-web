import { describe, expect, it } from "vitest";
import { durationShort, energyOfSessions, openSession, openTransactionId, sessionFigures, type TabSession } from "./ev-tab";

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
