import { describe, expect, it } from "vitest";
import { clearSkyWm2, cloudyWm2, solarOutlook, sunDay, sunElevation } from "./sun";

const CHENNAI = { lat: 13.0827, lng: 80.2707 };
const ist = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 19_800_000).toISOString().slice(11, 16) : null);
const minutes = (hhmm: string | null) => (hhmm ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) : NaN);

describe("sunDay", () => {
  it("puts sunrise and sunset in Chennai in mid October about where almanacs have them", () => {
    const day = sunDay("2026-10-12", CHENNAI.lat, CHENNAI.lng);
    // almanac: sunrise about 05:55, sunset about 17:45 (India time)
    expect(Math.abs(minutes(ist(day.sunrise)) - (5 * 60 + 55))).toBeLessThanOrEqual(6);
    expect(Math.abs(minutes(ist(day.sunset)) - (17 * 60 + 45))).toBeLessThanOrEqual(6);
    expect(Math.abs(day.daylightMin - 11 * 60 - 50)).toBeLessThanOrEqual(10);
  });

  it("has solar noon between them and the sun high above Chennai", () => {
    const day = sunDay("2026-10-12", CHENNAI.lat, CHENNAI.lng);
    expect(Date.parse(day.solarNoon)).toBeGreaterThan(Date.parse(day.sunrise!));
    expect(Date.parse(day.solarNoon)).toBeLessThan(Date.parse(day.sunset!));
    expect(day.maxElevationDeg).toBeGreaterThan(66);
    expect(day.maxElevationDeg).toBeLessThan(74);
  });

  it("has a longer day in June than in December", () => {
    expect(sunDay("2026-06-21", 28.6, 77.2).daylightMin).toBeGreaterThan(sunDay("2026-12-21", 28.6, 77.2).daylightMin + 120);
  });
});

describe("sunElevation", () => {
  it("is the day's highest at solar noon and below the horizon at midnight", () => {
    const day = sunDay("2026-10-12", CHENNAI.lat, CHENNAI.lng);
    expect(sunElevation(Date.parse(day.solarNoon), CHENNAI.lat, CHENNAI.lng)).toBeCloseTo(day.maxElevationDeg, 0);
    expect(sunElevation(Date.parse("2026-10-12T18:30:00Z"), CHENNAI.lat, CHENNAI.lng)).toBeLessThan(0); // midnight in India
  });
});

describe("sunshine strength", () => {
  it("is nothing at night and about a thousand W/m² under a high clear sun", () => {
    expect(clearSkyWm2(-5)).toBe(0);
    expect(clearSkyWm2(70)).toBeGreaterThan(950);
    expect(clearSkyWm2(70)).toBeLessThan(1100);
  });
  it("falls as cloud covers the sky", () => {
    expect(cloudyWm2(1000, 0)).toBe(1000);
    expect(cloudyWm2(1000, 100)).toBeCloseTo(250, 0);
    expect(cloudyWm2(1000, 50)).toBeGreaterThan(cloudyWm2(1000, 80));
  });
});

describe("solarOutlook", () => {
  const dayStart = Date.parse("2026-10-12T00:00:00Z") - 19_800_000;
  const cloud = (pct: number) => [0, 6, 12, 18, 24].map((h) => ({ ms: dayStart + h * 3_600_000, pct }));

  it("lists only the hours the sun is up, strongest around noon", () => {
    const out = solarOutlook("2026-10-12", CHENNAI.lat, CHENNAI.lng, cloud(0));
    expect(out.hours[0].hour).toBe(6); // sunrise is about 05:55: the hour that starts at 05:00 is mostly dark
    expect(out.hours.at(-1)?.hour).toBe(17);
    expect(out.peakHour).toBeGreaterThanOrEqual(11);
    expect(out.peakHour).toBeLessThanOrEqual(12);
    expect(out.potentialPct).toBe(100);
  });

  it("loses sunshine to cloud", () => {
    const clear = solarOutlook("2026-10-12", CHENNAI.lat, CHENNAI.lng, cloud(0));
    const cloudy = solarOutlook("2026-10-12", CHENNAI.lat, CHENNAI.lng, cloud(90));
    expect(cloudy.potentialPct).toBeLessThan(50);
    expect(cloudy.peakWm2).toBeLessThan(clear.peakWm2);
  });

  it("does not fail with no forecast", () => {
    expect(solarOutlook("2026-10-12", CHENNAI.lat, CHENNAI.lng, []).potentialPct).toBe(100);
  });
});
