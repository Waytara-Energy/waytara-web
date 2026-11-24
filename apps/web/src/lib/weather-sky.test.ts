import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, cloudDrift, mixColor, parseColor, precipitationLean, sanitizeSky, skyFromWeather, DEFAULT_SKY } from "./weather-sky";
import type { Condition } from "./weather";

const luma = (hex: string) => {
  const [r, g, b] = parseColor(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

describe("skyFromWeather", () => {
  it("a clear day has little cloud, no precipitation and a bright sun", () => {
    const s = skyFromWeather({ condition: "clear", cloudPct: 3 });
    expect(s.density).toBeLessThan(0.2);
    expect(s.rain + s.snow + s.fog + s.mist + s.lightning).toBe(0);
    expect(s.sun).toBeGreaterThan(0.7);
    expect(s.night).toBe(0);
  });

  it("the reported cloud cover sets how much cloud there is for dry skies", () => {
    const thin = skyFromWeather({ condition: "partly", cloudPct: 20 }).density;
    const thick = skyFromWeather({ condition: "partly", cloudPct: 80 }).density;
    expect(thick).toBeGreaterThan(thin + 0.3);
    expect(skyFromWeather({ condition: "cloudy", cloudPct: 100 }).density).toBeGreaterThan(0.8);
    expect(skyFromWeather({ condition: "cloudy", cloudPct: 100 }).density).toBeLessThan(0.95);
  });

  it("rain, snow and storms are always heavily clouded, whatever the cloud figure says", () => {
    for (const c of ["drizzle", "rain", "heavyrain", "thunder", "snow", "sleet"] as Condition[]) {
      expect(skyFromWeather({ condition: c, cloudPct: 10 }).density, c).toBeGreaterThan(0.85);
    }
  });

  it("drizzle has fine drops and a downpour has big ones", () => {
    const d = skyFromWeather({ condition: "drizzle" });
    const h = skyFromWeather({ condition: "heavyrain" });
    expect(d.rain).toBeGreaterThan(0);
    expect(d.drop).toBe(0);
    expect(h.drop).toBe(1);
    expect(h.rain).toBeGreaterThan(d.rain);
  });

  it("a thunderstorm has rain, flashes and the darkest clouds", () => {
    const t = skyFromWeather({ condition: "thunder" });
    expect(t.lightning).toBeGreaterThan(0.5);
    expect(t.rain).toBeGreaterThan(0.5);
    expect(t.dark).toBeGreaterThan(0.9);
    expect(skyFromWeather({ condition: "rain" }).lightning).toBe(0);
  });

  it("fog and snow are their own settings, and snow is not rain", () => {
    expect(skyFromWeather({ condition: "fog" }).fog).toBeGreaterThan(0.5);
    const snow = skyFromWeather({ condition: "snow" });
    expect(snow.snow).toBeGreaterThan(0.5);
    expect(snow.rain).toBe(0);
    const sleet = skyFromWeather({ condition: "sleet" });
    expect(sleet.rain).toBeGreaterThan(0);
    expect(sleet.snow).toBeGreaterThan(0);
  });

  it("more forecast rain makes rain stronger, never beyond the limit", () => {
    const light = skyFromWeather({ condition: "rain", rainMm: 0 }).rain;
    const heavy = skyFromWeather({ condition: "rain", rainMm: 8 }).rain;
    expect(heavy).toBeGreaterThan(light);
    expect(skyFromWeather({ condition: "heavyrain", rainMm: 40 }).rain).toBeLessThanOrEqual(1);
  });

  it("mist appears on damp, still mornings with no rain, and not otherwise", () => {
    expect(skyFromWeather({ condition: "cloudy", humidityPct: 96, windMs: 1 }).mist).toBeGreaterThan(0);
    expect(skyFromWeather({ condition: "cloudy", humidityPct: 96, windMs: 6 }).mist).toBe(0);
    expect(skyFromWeather({ condition: "cloudy", humidityPct: 70, windMs: 1 }).mist).toBe(0);
    expect(skyFromWeather({ condition: "rain", humidityPct: 98, windMs: 1 }).mist).toBe(0);
    expect(skyFromWeather({ condition: "fog", humidityPct: 98, windMs: 1 }).mist).toBe(0);
  });

  it("night turns the sun off and the sky dark; storms are greyer than fair weather", () => {
    const day = skyFromWeather({ condition: "fair", night: false });
    const night = skyFromWeather({ condition: "fair", night: true });
    expect(night.sun).toBe(0);
    expect(night.night).toBe(1);
    expect(luma(night.skyHigh)).toBeLessThan(luma(day.skyHigh));
    expect(luma(night.skyLow)).toBeLessThan(luma(day.skyLow));
    expect(luma(skyFromWeather({ condition: "thunder" }).skyHigh)).toBeLessThan(luma(day.skyHigh));
  });

  it("takes its colours from the palette it is given (the dashboard has its own)", () => {
    const red = skyFromWeather({ condition: "clear" }, { dayTop: "#ff0000", dayLow: "#00ff00", cloudDay: "#0000ff" });
    expect(parseColor(red.skyHigh)[0]).toBeGreaterThan(0.85);
    expect(parseColor(red.skyLow)[1]).toBeGreaterThan(0.85);
    expect(parseColor(red.cloudColor)[2]).toBeGreaterThan(0.9);
    expect(skyFromWeather({ condition: "clear" }).skyHigh).toBe(skyFromWeather({ condition: "clear" }, DEFAULT_PALETTE).skyHigh);
  });

  it("uses the wind of the report, and a default when the report has none", () => {
    const s = skyFromWeather({ condition: "clear", windMs: 12, windFromDeg: 45 });
    expect(s.windMs).toBe(12);
    expect(s.windFromDeg).toBe(45);
    const none = skyFromWeather({ condition: "clear", windMs: null, windFromDeg: null });
    expect(none.windMs).toBe(DEFAULT_SKY.windMs);
    expect(none.windFromDeg).toBe(DEFAULT_SKY.windFromDeg);
  });
});

describe("the wind", () => {
  it("clouds travel the way the wind blows: a west wind carries them east (to the right)", () => {
    expect(cloudDrift(270, 5).x).toBeGreaterThan(0);
    expect(cloudDrift(90, 5).x).toBeLessThan(0);
  });

  it("a north wind carries clouds south (down the screen), more gently than a west wind of the same speed", () => {
    const n = cloudDrift(0, 5);
    expect(n.y).toBeLessThan(0);
    expect(Math.abs(n.y)).toBeLessThan(Math.abs(cloudDrift(270, 5).x));
  });

  it("stronger wind moves clouds faster, calm air still moves them a little, and speed scales it", () => {
    expect(Math.hypot(cloudDrift(270, 12).x, cloudDrift(270, 12).y)).toBeGreaterThan(Math.hypot(cloudDrift(270, 2).x, cloudDrift(270, 2).y));
    expect(cloudDrift(270, 0).x).toBeGreaterThan(0);
    expect(cloudDrift(270, 5, 2).x).toBeCloseTo(cloudDrift(270, 5, 1).x * 2, 6);
    expect(cloudDrift(270, 5, 0).x).toBe(0);
  });

  it("rotation turns the direction the clouds travel", () => {
    expect(cloudDrift(270, 5, 1, 90).x).not.toBeCloseTo(cloudDrift(270, 5, 1, 0).x, 3);
  });

  it("rain and snow lean with the wind, and never past the limit", () => {
    expect(precipitationLean(270, 8)).toBeGreaterThan(0);
    expect(precipitationLean(90, 8)).toBeLessThan(0);
    expect(Math.abs(precipitationLean(270, 40))).toBeLessThanOrEqual(0.7);
    expect(precipitationLean(0, 8)).toBeCloseTo(0, 6);
  });
});

describe("colours and limits", () => {
  it("mixes two colours", () => {
    expect(mixColor("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixColor("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("reads hex and rgb colours", () => {
    expect(parseColor("#f00")).toEqual([1, 0, 0]);
    expect(parseColor("rgb(0, 255, 0)")).toEqual([0, 1, 0]);
  });

  it("keeps every setting in range, whatever is passed", () => {
    const s = sanitizeSky({ ...DEFAULT_SKY, density: 5, rain: -2, scale: Number.NaN, speed: 99, windMs: -4, windFromDeg: -90, seed: 4321 });
    expect(s.density).toBe(1);
    expect(s.rain).toBe(0);
    expect(s.scale).toBe(1);
    expect(s.speed).toBe(5);
    expect(s.windMs).toBe(0);
    expect(s.windFromDeg).toBe(270);
    expect(s.seed).toBe(321);
  });
});
