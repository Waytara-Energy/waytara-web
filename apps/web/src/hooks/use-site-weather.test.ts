import { describe, expect, it } from "vitest";
import type { HourPoint, Weather } from "@/lib/weather";
import { weatherAt, type Stored } from "./use-site-weather";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 13, 3, 0, 0); // 08:30 India time is 03:00 UTC

const hour = (i: number, tempC: number, condition: HourPoint["condition"] = "partly"): HourPoint => ({
  time: new Date(T0 + i * HOUR).toISOString(),
  hour: i,
  tempC,
  cloudPct: 40,
  windMs: 2,
  windFromDeg: 90,
  humidityPct: 60,
  uvIndex: 5,
  rainMm: 0,
  spanH: 1,
  condition,
  night: false,
  wm2: 300,
});

const stored: Stored = {
  day: "2026-11-13",
  hours: [hour(0, 26), hour(1, 27, "clear"), hour(2, 29), hour(3, 31, "cloudy")],
  weather: {
    now: { tempC: 20, condition: "fog", night: true, humidityPct: 90, windMs: 1, cloudPct: 90, windFromDeg: 0, uvIndex: 0, pressureHpa: 1010, rainMm: 0, at: new Date(T0).toISOString() },
    days: [],
    sun: {},
    solar: { hours: [], potentialPct: 50, peakWm2: 800, peakHour: 12 },
    updatedAt: new Date(T0).toISOString(),
  } as unknown as Weather,
};

describe("weatherAt", () => {
  it("takes the conditions from the forecast hour that is current", () => {
    const w = weatherAt(stored, T0 + HOUR + 20 * 60_000)!;
    expect(w.now.tempC).toBe(27);
    expect(w.now.condition).toBe("clear");
    expect(w.now.at).toBe(new Date(T0 + HOUR).toISOString());
  });

  it("moves on to the next hour when the hour changes, from the same stored forecast", () => {
    expect(weatherAt(stored, T0 + 2 * HOUR + 1)!.now.tempC).toBe(29);
    expect(weatherAt(stored, T0 + 3 * HOUR + 1)!.now.tempC).toBe(31);
  });

  it("keeps what the forecast does not say about an hour (the pressure)", () => {
    expect(weatherAt(stored, T0 + 5 * 60_000)!.now.pressureHpa).toBe(1010);
  });

  it("serves a time a little after the last hour, not one long after it", () => {
    expect(weatherAt(stored, T0 + 3 * HOUR + 2 * HOUR)).not.toBeNull();
    expect(weatherAt(stored, T0 + 3 * HOUR + 5 * HOUR)).toBeNull();
  });

  it("serves a time a little before the first hour", () => {
    expect(weatherAt(stored, T0 - HOUR)!.now.tempC).toBe(26);
    expect(weatherAt(stored, T0 - 6 * HOUR)).toBeNull();
  });
});
