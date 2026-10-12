// Where the sun is, for a solar site: sunrise, sunset, solar noon, how high the sun climbs, and how strong the sunshine is hour by hour with
// and without cloud. Pure maths (the NOAA solar-position equations, good to about a minute for sunrise and sunset), so it needs no service
// and is tested. Times are returned as ISO strings (UTC); the page shows them in India time.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const IST_MS = 19_800_000;

interface SolarParams {
  /** Declination of the sun, radians. */
  decl: number;
  /** Equation of time, minutes. */
  eqTime: number;
}

function solarParams(ms: number): SolarParams {
  const jd = ms / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  const l0 = (280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35_999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * m * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    4 * DEG * (y * Math.sin(2 * l0 * RAD) - 2 * e * Math.sin(m * RAD) + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) - 0.5 * y * y * Math.sin(4 * l0 * RAD) - 1.25 * e * e * Math.sin(2 * m * RAD));
  return { decl, eqTime };
}

export interface SunDay {
  /** ISO times (UTC); null where the sun does not rise or set that day. */
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string;
  /** Minutes between sunrise and sunset. */
  daylightMin: number;
  /** How high the sun climbs at solar noon, degrees above the horizon. */
  maxElevationDeg: number;
}

/** Sunrise, sunset and solar noon at a place on an India date (YYYY-MM-DD). */
export function sunDay(istDate: string, lat: number, lng: number): SunDay {
  const [y, mo, d] = istDate.split("-").map(Number);
  // The calendar day in India: its noon in India time is where the sun's position is worked out (the answer barely moves over the day).
  const dayStartMs = Date.UTC(y, mo - 1, d) - IST_MS;
  const { decl, eqTime } = solarParams(dayStartMs + 12 * 3_600_000);
  const noonMin = 720 - 4 * lng - eqTime; // minutes after UTC midnight of the sun's own day
  const dayUtcMidnight = Date.UTC(y, mo - 1, d);
  const at = (min: number) => new Date(dayUtcMidnight + min * 60_000).toISOString();
  const cosHa = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  const maxElevationDeg = 90 - Math.abs(lat - decl * DEG);
  if (cosHa > 1 || cosHa < -1) return { sunrise: null, sunset: null, solarNoon: at(noonMin), daylightMin: cosHa < -1 ? 1440 : 0, maxElevationDeg };
  const ha = Math.acos(cosHa) * DEG;
  return { sunrise: at(noonMin - 4 * ha), sunset: at(noonMin + 4 * ha), solarNoon: at(noonMin), daylightMin: Math.round(8 * ha), maxElevationDeg };
}

/** The height of the sun above the horizon at a moment, in degrees (negative at night). */
export function sunElevation(ms: number, lat: number, lng: number): number {
  const { decl, eqTime } = solarParams(ms);
  const utcMin = (ms / 60_000) % 1440;
  const trueSolarMin = (utcMin + eqTime + 4 * lng + 1440 * 2) % 1440;
  const ha = (trueSolarMin / 4 - 180) * RAD;
  const cosZ = Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) * DEG;
}

/** Sunshine on level ground under a clear sky, W/m² (Haurwitz), from the sun's height in degrees. */
export function clearSkyWm2(elevationDeg: number): number {
  if (elevationDeg <= 0) return 0;
  const cosZ = Math.sin(elevationDeg * RAD);
  return 1098 * cosZ * Math.exp(-0.057 / cosZ);
}

/** Sunshine under cloud, W/m² (Kasten and Czeplak): `cloudPct` of the sky covered cuts the clear-sky value. */
export function cloudyWm2(clearWm2: number, cloudPct: number): number {
  const n = Math.max(0, Math.min(100, cloudPct)) / 100;
  return clearWm2 * (1 - 0.75 * n ** 3.4);
}

export interface SolarHour {
  /** Hour of the day in India time (the hour that starts then). */
  hour: number;
  /** Expected sunshine in that hour with the forecast cloud, and with none, W/m². */
  wm2: number;
  clearWm2: number;
  cloudPct: number;
}

export interface SolarOutlook {
  hours: SolarHour[];
  /** How much of a perfectly clear day's sunshine the forecast cloud leaves, 0 to 100. */
  potentialPct: number;
  peakWm2: number;
  /** The hour (India time) the sunshine is strongest. */
  peakHour: number | null;
}

/** The sunshine hour by hour on an India date, given the cloud cover (percent) at moments through that day. A moment the forecast does not
 *  reach takes the nearest cloud value that it does. */
export function solarOutlook(istDate: string, lat: number, lng: number, cloud: { ms: number; pct: number }[]): SolarOutlook {
  const [y, mo, d] = istDate.split("-").map(Number);
  const dayStartMs = Date.UTC(y, mo - 1, d) - IST_MS;
  const sorted = [...cloud].sort((a, b) => a.ms - b.ms);
  const cloudAt = (ms: number): number => {
    if (sorted.length === 0) return 0;
    if (ms <= sorted[0].ms) return sorted[0].pct;
    const last = sorted[sorted.length - 1];
    if (ms >= last.ms) return last.pct;
    const i = sorted.findIndex((c) => c.ms >= ms);
    const a = sorted[i - 1];
    const b = sorted[i];
    return a.pct + ((b.pct - a.pct) * (ms - a.ms)) / (b.ms - a.ms);
  };
  const hours: SolarHour[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const mid = dayStartMs + (hour + 0.5) * 3_600_000;
    const clear = clearSkyWm2(sunElevation(mid, lat, lng));
    if (clear <= 0) continue;
    const pct = cloudAt(mid);
    hours.push({ hour, clearWm2: Math.round(clear), wm2: Math.round(cloudyWm2(clear, pct)), cloudPct: Math.round(pct) });
  }
  const clearSum = hours.reduce((s, h) => s + h.clearWm2, 0);
  const sum = hours.reduce((s, h) => s + h.wm2, 0);
  const peak = hours.reduce<SolarHour | null>((best, h) => (best === null || h.wm2 > best.wm2 ? h : best), null);
  return { hours, potentialPct: clearSum > 0 ? Math.round((sum / clearSum) * 100) : 0, peakWm2: peak?.wm2 ?? 0, peakHour: peak?.hour ?? null };
}
