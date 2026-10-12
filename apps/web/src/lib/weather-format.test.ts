import { describe, expect, it } from "vitest";
import { compass, durationText, solarVerdict, sunStatus, uvLabel } from "./weather-format";
import type { SunDay } from "./sun";

const sun: SunDay = { sunrise: "2026-10-12T00:25:00Z", sunset: "2026-10-12T12:15:00Z", solarNoon: "2026-10-12T06:20:00Z", daylightMin: 710, maxElevationDeg: 69 };
const clock = (iso: string) => iso.slice(11, 16);

describe("weather words", () => {
  it("names the wind's direction", () => {
    expect(compass(0)).toBe("N");
    expect(compass(92)).toBe("E");
    expect(compass(225)).toBe("SW");
    expect(compass(359)).toBe("N");
    expect(compass(-45)).toBe("NW");
  });
  it("puts the UV index in words", () => {
    expect([1, 4, 7, 9, 12].map(uvLabel)).toEqual(["Low", "Moderate", "High", "Very high", "Extreme"]);
  });
  it("writes a duration", () => {
    expect(durationText(130)).toBe("2h 10m");
    expect(durationText(45)).toBe("45m");
    expect(durationText(-5)).toBe("0m");
  });
});

describe("sunStatus", () => {
  it("counts down to sunrise before dawn", () => {
    expect(sunStatus(sun, Date.parse("2026-10-11T23:25:00Z"), null, clock).text).toBe("The sun rises in 1h 00m, at 00:25");
  });
  it("shows how far through the day the sun is, and when it sets", () => {
    const s = sunStatus(sun, Date.parse("2026-10-12T06:20:00Z"), null, clock);
    expect(s.progressPct).toBe(50);
    expect(s.text).toBe("The sun sets in 5h 55m, at 12:15");
  });
  it("says when it rises again after sunset", () => {
    const s = sunStatus(sun, Date.parse("2026-10-12T14:00:00Z"), "2026-10-13T00:26:00Z", clock);
    expect(s.progressPct).toBeNull();
    expect(s.text).toBe("The sun is down. It rises tomorrow at 00:26");
  });
});

describe("solarVerdict", () => {
  it("grades the day", () => {
    expect(solarVerdict(90).tone).toBe("good");
    expect(solarVerdict(60).tone).toBe("fair");
    expect(solarVerdict(20).tone).toBe("poor");
  });
});
