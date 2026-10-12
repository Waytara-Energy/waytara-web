// Words for the weather and sun panel. Pure, so they are tested.
import type { SunDay } from "./sun";

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** The compass point the wind comes from. */
export function compass(deg: number): string {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** The UV index in words. */
export function uvLabel(uv: number): string {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

/** "2h 10m", "45m". */
export function durationText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

export interface SunStatus {
  /** Where the sun is in its day, 0 at sunrise to 100 at sunset; null when it is down. */
  progressPct: number | null;
  text: string;
}

/** Whether the sun is up, and when it next sets or rises. `nextSunrise` is tomorrow's, for the evening. */
export function sunStatus(sun: SunDay, nowMs: number, nextSunrise: string | null, clock: (iso: string) => string): SunStatus {
  if (!sun.sunrise || !sun.sunset) return { progressPct: null, text: sun.daylightMin >= 1440 ? "The sun does not set today" : "The sun does not rise today" };
  const rise = Date.parse(sun.sunrise);
  const set = Date.parse(sun.sunset);
  if (nowMs < rise) return { progressPct: null, text: `The sun rises in ${durationText((rise - nowMs) / 60_000)}, at ${clock(sun.sunrise)}` };
  if (nowMs >= set) return { progressPct: null, text: nextSunrise ? `The sun is down. It rises tomorrow at ${clock(nextSunrise)}` : "The sun is down" };
  return { progressPct: Math.round(((nowMs - rise) / (set - rise)) * 100), text: `The sun sets in ${durationText((set - nowMs) / 60_000)}, at ${clock(sun.sunset)}` };
}

export interface SolarVerdict {
  tone: "good" | "fair" | "poor";
  text: string;
}

/** What the expected sunshine (percent of a clear day) means for generation. */
export function solarVerdict(potentialPct: number): SolarVerdict {
  if (potentialPct >= 75) return { tone: "good", text: "A good day for solar" };
  if (potentialPct >= 45) return { tone: "fair", text: "Some cloud will trim generation" };
  return { tone: "poor", text: "Heavy cloud: expect low generation" };
}
