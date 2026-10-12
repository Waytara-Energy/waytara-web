import { describe, expect, it } from "vitest";
import { conditionOf, forecastDays, roundCoordinate, summarizeWeather, type MetResponse } from "./weather";

// Times are UTC; India is 5 h 30 m ahead, so 2026-10-10T06:30Z is noon on the 10th there.
const step = (time: string, temp: number, symbol: string, rain6?: number) => ({
  time,
  data: {
    instant: { details: { air_temperature: temp, relative_humidity: 60, wind_speed: 3, cloud_area_fraction: 40 } },
    next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: 0 } },
    ...(rain6 !== undefined ? { next_6_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: rain6 } } } : {}),
  },
});

const res: MetResponse = {
  properties: {
    meta: { updated_at: "2026-10-10T05:00:00Z" },
    timeseries: [
      step("2026-10-10T00:00:00Z", 24, "partlycloudy_day", 0),
      step("2026-10-10T06:00:00Z", 31, "clearsky_day", 0),
      step("2026-10-10T12:00:00Z", 28, "rain", 4.2),
      step("2026-10-10T18:00:00Z", 25, "cloudy", 1.1),
      step("2026-10-11T06:00:00Z", 33, "clearsky_day", 0),
    ],
  },
};

describe("conditionOf", () => {
  it("reads MET symbol codes as plain conditions", () => {
    expect(conditionOf("clearsky_day")).toEqual({ condition: "clear", night: false });
    expect(conditionOf("partlycloudy_night")).toEqual({ condition: "partly", night: true });
    expect(conditionOf("lightrainshowers_day").condition).toBe("drizzle");
    expect(conditionOf("heavyrainandthunder").condition).toBe("thunder");
    expect(conditionOf("rainshowers_day").condition).toBe("rain");
    expect(conditionOf("snow").condition).toBe("snow");
    expect(conditionOf("fog").condition).toBe("fog");
    expect(conditionOf(undefined).condition).toBe("cloudy");
  });
});

describe("summarizeWeather", () => {
  const now = Date.parse("2026-10-10T07:00:00Z");
  const w = summarizeWeather(res, now, 13.0827, 80.2707)!;

  it("takes the conditions now from the step that is current", () => {
    expect(w.now).toMatchObject({ tempC: 31, condition: "clear", humidityPct: 60, windMs: 3, cloudPct: 40 });
  });
  it("gives each India day its range, its rain and the worst of its daytime", () => {
    const today = w.days[0];
    expect(today.date).toBe("2026-10-10");
    expect(today.minC).toBe(24);
    expect(today.maxC).toBe(31);
    expect(today.rainMm).toBe(5.3);
    // 06:00Z is 11:30 in India (clear), 12:00Z is 17:30 (rain): the rain is what the day is called
    expect(today.condition).toBe("rain");
  });
  it("lists the following day too", () => {
    expect(w.days[1]).toMatchObject({ date: "2026-10-11", condition: "clear" });
  });
  it("is null when there is no forecast", () => {
    expect(summarizeWeather({ properties: { timeseries: [] } }, now, 13.0827, 80.2707)).toBeNull();
  });
  it("says when the sun is up and how strong it will be, from the place and the cloud", () => {
    expect(w.sun.sunrise).not.toBeNull();
    expect(Date.parse(w.sun.sunrise!)).toBeLessThan(Date.parse(w.sun.sunset!));
    expect(w.solar.hours.length).toBeGreaterThan(8);
    expect(w.solar.potentialPct).toBeGreaterThan(0);
    expect(w.solar.potentialPct).toBeLessThan(100); // there is some cloud (40%)
    expect(w.days[0].solarPct).toBe(w.solar.potentialPct);
    expect(w.days[0].sunrise).toBe(w.sun.sunrise);
  });
  it("reads the extra conditions MET gives, when it gives them", () => {
    const more: MetResponse = { properties: { timeseries: [{ time: "2026-10-10T06:00:00Z", data: { instant: { details: { air_temperature: 30, wind_from_direction: 90, ultraviolet_index_clear_sky: 9.4, air_pressure_at_sea_level: 1008 } } } }] } };
    expect(summarizeWeather(more, now, 13.0827, 80.2707)?.now).toMatchObject({ windFromDeg: 90, uvIndex: 9.4, pressureHpa: 1008 });
  });
  it("rounds coordinates to the four decimals MET allows", () => {
    expect(roundCoordinate(11.016844123)).toBe(11.0168);
  });
});

describe("forecastDays", () => {
  const now = Date.parse("2026-10-10T07:00:00Z");
  const days = forecastDays(res, now, 13.0827, 80.2707);

  it("keeps every forecast moment of each India day, with its own conditions", () => {
    expect(days[0].date).toBe("2026-10-10");
    // 00:00Z 06:00Z 12:00Z 18:00Z are all on the 10th in India (05:30, 11:30, 17:30, 23:30)
    expect(days[0].hours.map((h) => h.hour)).toEqual([5, 11, 17, 23]);
    expect(days[0].hours[1]).toMatchObject({ tempC: 31, condition: "clear", cloudPct: 40, windMs: 3, humidityPct: 60 });
    expect(days[0].hours[2]).toMatchObject({ condition: "rain", rainMm: 0 });
  });
  it("adds up each day: cloud, humidity, wind, the sun and the sunshine", () => {
    expect(days[0]).toMatchObject({ avgCloudPct: 40, avgHumidityPct: 60, maxWindMs: 3 });
    expect(days[0].sun.sunrise).not.toBeNull();
    expect(days[0].solar.potentialPct).toBeGreaterThan(0);
    // the sun is up at 11:30 but not at 05:30 or 23:30
    expect(days[0].hours[1].wm2).toBeGreaterThan(300);
    expect(days[0].hours[0].wm2).toBe(0);
    expect(days[0].hours[3].wm2).toBe(0);
  });
  it("is empty when there is no forecast", () => {
    expect(forecastDays({ properties: { timeseries: [] } }, now, 13.0827, 80.2707)).toEqual([]);
  });
});
