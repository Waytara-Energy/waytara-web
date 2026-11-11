import { describe, expect, it } from "vitest";
import { approximate, feelsLike, hourIn, publicWeatherFrom } from "./public-weather";
import { forecastDays, summarizeWeather, type MetResponse } from "./weather";

const NOW = Date.parse("2026-11-11T06:30:00Z");
const step = (time: string, temp: number, code: string) => ({
  time,
  data: {
    instant: { details: { air_temperature: temp, relative_humidity: 70, wind_speed: 3, cloud_area_fraction: 40 } },
    next_1_hours: { summary: { symbol_code: code }, details: { precipitation_amount: 0 } },
  },
});
const res: MetResponse = {
  properties: {
    meta: { updated_at: "2026-11-11T06:00:00Z" },
    timeseries: ["06", "07", "08", "09", "10", "11", "12", "13"].map((h, i) => step(`2026-11-11T${h}:00:00Z`, 30 + i, i === 3 ? "lightrain" : "partlycloudy_day")),
  },
};

describe("public weather", () => {
  it("rounds a position to about a kilometre", () => {
    expect(approximate(13.083694)).toBe(13.08);
    expect(approximate(-80.2707)).toBe(-80.27);
  });
  it("feels warmer when humid and cooler in wind", () => {
    expect(feelsLike(32, 80, 1)).toBeGreaterThan(feelsLike(32, 30, 1));
    expect(feelsLike(32, 60, 8)).toBeLessThan(feelsLike(32, 60, 1));
  });
  it("reads the hour in the visitor's time zone, and survives an unknown zone", () => {
    expect(hourIn(Date.parse("2026-11-11T06:30:00Z"), "Asia/Kolkata")).toBe(12);
    expect(hourIn(Date.parse("2026-11-11T06:30:00Z"), "Not/AZone")).toBe(12);
  });
  it("builds the header reading: now, the next six hours, and the solar line", () => {
    const forecast = { weather: summarizeWeather(res, NOW, 13.08, 80.27)!, days: forecastDays(res, NOW, 13.08, 80.27) };
    const w = publicWeatherFrom(forecast, NOW, "Asia/Kolkata", "Chennai")!;
    expect(w.place).toBe("Chennai");
    expect(w.tempC).toBe(30);
    expect(w.condition).toBe("partly");
    expect(w.windKmh).toBe(11);
    expect(w.hours).toHaveLength(6);
    expect(w.hours[0].hour).toBe(12); // the next step, 07:00 UTC, is 12:30 India time
    expect(w.outlook).toMatch(/Rain/); // the 09:00 UTC step is light rain
  });
  it("gives nothing when the forecast has no temperature", () => {
    const bare = { properties: { timeseries: [{ time: "2026-11-11T06:00:00Z", data: {} }] } } as MetResponse;
    const forecast = { weather: summarizeWeather(bare, NOW, 13, 80)!, days: [] };
    expect(publicWeatherFrom(forecast, NOW, "Asia/Kolkata", null)).toBeNull();
  });
});
