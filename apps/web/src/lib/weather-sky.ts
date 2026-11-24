import type { Condition } from "./weather";

// The settings of the weather sky (components/ui/weather-sky.tsx) and the rules that turn a weather report into them. Pure and tested: the drawing only reads
// what these functions say, so "partly cloudy, light wind from the west" or "thunderstorm" is decided here, not inside a shader.

/** Everything that can be set on the sky. Every number is 0 to 1 unless it says otherwise. */
export interface WeatherSkyParams {
  // The clouds (the controls of a cloud background: density, opacity, seed, speed, rotation, scale, shadows, highlights, two sky colours).
  /** How much of the sky the clouds cover: 0 clear, 1 overcast. */
  density: number;
  opacity: number;
  /** Any number: a different seed is a different arrangement of clouds. */
  seed: number;
  /** Multiplies how fast everything moves (the clouds and the falling rain and snow). 1 = normal. */
  speed: number;
  /** Degrees added to the direction the clouds travel (on top of the wind's own direction). */
  rotation: number;
  /** Size of the cloud shapes: 1 = normal, 2 = twice as broad, 0.5 = half as broad. */
  scale: number;
  shadows: number;
  highlights: number;
  skyHigh: string;
  skyLow: string;
  cloudColor: string;
  // The wind.
  /** Where the wind comes from, degrees clockwise from north (as in a forecast). Clouds travel the opposite way and rain and snow lean with it. */
  windFromDeg: number;
  /** Wind speed in metres per second. */
  windMs: number;
  // The weather.
  /** How dark and heavy the clouds look: 0 white fair-weather clouds, 1 storm clouds. */
  dark: number;
  rain: number;
  /** The size of the drops: 0 drizzle (fine, short, slow), 1 a downpour (long, fast). */
  drop: number;
  snow: number;
  fog: number;
  mist: number;
  /** 0 none; above 0 lightning flashes and bolts, more often as it goes to 1. */
  lightning: number;
  /** The sun's glow (fades behind cloud). */
  sun: number;
  night: number;
}

export const DEFAULT_SKY: WeatherSkyParams = {
  density: 0.5, opacity: 1, seed: 7, speed: 1, rotation: 0, scale: 1, shadows: 0.7, highlights: 0.7,
  skyHigh: "#3876ba", skyLow: "#8cbfe8", cloudColor: "#fbf8f2",
  windFromDeg: 270, windMs: 3,
  dark: 0, rain: 0, drop: 0.5, snow: 0, fog: 0, mist: 0, lightning: 0, sun: 1, night: 0,
};

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---- colours ----

export function parseColor(color: string): [number, number, number] {
  const v = color.trim();
  if (v.startsWith("#")) {
    const h = v.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
    const n = parseInt(full, 16);
    if (Number.isFinite(n)) return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = v.match(/[\d.]+/g);
  if (m && m.length >= 3) return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  return [0.9, 0.9, 0.9];
}

export function mixColor(a: string, b: string, t: number): string {
  const x = parseColor(a);
  const y = parseColor(b);
  const k = clamp01(t);
  const hex = (i: number) => Math.round((x[i] + (y[i] - x[i]) * k) * 255).toString(16).padStart(2, "0");
  return `#${hex(0)}${hex(1)}${hex(2)}`;
}

// ---- the wind ----

/**
 * Which way the clouds travel on the screen and how fast, from a forecast's wind. A forecast gives where the wind comes FROM (270 = from the west), so the clouds
 * travel the other way (towards the east, to the right of the screen). North is the top of the screen. Straight up and down is damped, so a north wind moves
 * the clouds a little and not as fast as a west wind. Returns world units per second.
 */
export function cloudDrift(windFromDeg: number, windMs: number, speed = 1, rotationDeg = 0): { x: number; y: number } {
  const to = ((windFromDeg + 180 + rotationDeg) * Math.PI) / 180;
  const pace = (0.012 + 0.02 * clamp(windMs, 0, 30)) * Math.max(0, speed);
  return { x: Math.sin(to) * pace, y: Math.cos(to) * pace * 0.35 };
}

/** How far rain and snow lean (positive: towards the right of the screen as they fall), from the wind. About 0.7 is a gale. */
export function precipitationLean(windFromDeg: number, windMs: number): number {
  const to = ((windFromDeg + 180) * Math.PI) / 180;
  return clamp(Math.sin(to) * clamp(windMs, 0, 30) * 0.045, -0.7, 0.7);
}

// ---- from a weather report ----

/** What of a weather report the sky uses (the fields of lib/weather's WeatherNow). Anything missing is treated as unknown. */
export interface SkyWeatherInput {
  condition: Condition;
  night?: boolean;
  cloudPct?: number | null;
  windMs?: number | null;
  windFromDeg?: number | null;
  /** Rain expected in the next hour, mm. */
  rainMm?: number | null;
  humidityPct?: number | null;
}

interface Preset {
  density: number;
  dark: number;
  rain: number;
  drop: number;
  snow: number;
  fog: number;
  lightning: number;
  sun: number;
}

const PRESETS: Record<Condition, Preset> = {
  clear: { density: 0.1, dark: 0, rain: 0, drop: 0.5, snow: 0, fog: 0, lightning: 0, sun: 1 },
  fair: { density: 0.28, dark: 0, rain: 0, drop: 0.5, snow: 0, fog: 0, lightning: 0, sun: 1 },
  partly: { density: 0.5, dark: 0.08, rain: 0, drop: 0.5, snow: 0, fog: 0, lightning: 0, sun: 0.8 },
  cloudy: { density: 0.82, dark: 0.25, rain: 0, drop: 0.5, snow: 0, fog: 0, lightning: 0, sun: 0.2 },
  fog: { density: 0.55, dark: 0.15, rain: 0, drop: 0.5, snow: 0, fog: 0.85, lightning: 0, sun: 0.1 },
  drizzle: { density: 0.9, dark: 0.45, rain: 0.45, drop: 0, snow: 0, fog: 0, lightning: 0, sun: 0 },
  rain: { density: 0.95, dark: 0.6, rain: 0.75, drop: 0.5, snow: 0, fog: 0, lightning: 0, sun: 0 },
  heavyrain: { density: 1, dark: 0.82, rain: 1, drop: 1, snow: 0, fog: 0, lightning: 0, sun: 0 },
  sleet: { density: 0.95, dark: 0.6, rain: 0.5, drop: 0.25, snow: 0.45, fog: 0, lightning: 0, sun: 0 },
  snow: { density: 0.92, dark: 0.35, rain: 0, drop: 0.5, snow: 0.8, fog: 0.15, lightning: 0, sun: 0 },
  thunder: { density: 1, dark: 0.96, rain: 0.85, drop: 0.8, snow: 0, fog: 0, lightning: 0.9, sun: 0 },
};

/** The colours of the sky: a clear day and an overcast day, a clear night and an overcast night (the sky is mixed between the clear and overcast pair as the weather greys over). */
export interface SkyPalette {
  dayTop: string;
  dayLow: string;
  dayGreyTop: string;
  dayGreyLow: string;
  nightTop: string;
  nightLow: string;
  nightGreyTop: string;
  nightGreyLow: string;
  cloudDay: string;
  cloudNight: string;
}

/** The dashboard's sky: lighter greys by day (the header's dark text sits on it) and the dusk sky in the dark theme. */
export const DASHBOARD_PALETTE: Partial<SkyPalette> = {
  dayTop: "#4a89d0", dayLow: "#9cc9f0", dayGreyTop: "#7d8da3", dayGreyLow: "#a4afbd",
  nightTop: "#070d1f", nightLow: "#1b2a4a", nightGreyTop: "#0c121c", nightGreyLow: "#2a3544",
  cloudDay: "#fbf8f2", cloudNight: "#8d9bb8",
};

export const DEFAULT_PALETTE: SkyPalette = {
  dayTop: "#2f6dbd", dayLow: "#8cc0ee", dayGreyTop: "#46525e", dayGreyLow: "#8d98a3",
  nightTop: "#050a1a", nightLow: "#16233f", nightGreyTop: "#0a0f18", nightGreyLow: "#222c3a",
  cloudDay: "#fbf8f2", cloudNight: "#8d9bb8",
};

/**
 * The sky for a weather report: how much cloud, how dark, which kind of rain, snow, fog or lightning, how fast the wind moves it and which way, by day or night.
 * Cloud cover in the report sets the amount of cloud for clear to cloudy skies; a rainy or snowy sky is always heavily clouded. Rain and snow are stronger when the
 * forecast rain amount is high. Mist (a thin low haze) appears on damp, still mornings without rain. Other settings can still be overridden afterwards.
 */
export function skyFromWeather(w: SkyWeatherInput, palette: Partial<SkyPalette> = {}): WeatherSkyParams {
  const c = { ...DEFAULT_PALETTE, ...palette };
  const p = PRESETS[w.condition] ?? PRESETS.cloudy;
  const night = w.night ? 1 : 0;
  const windMs = typeof w.windMs === "number" ? clamp(w.windMs, 0, 40) : DEFAULT_SKY.windMs;
  const windFromDeg = typeof w.windFromDeg === "number" ? w.windFromDeg : DEFAULT_SKY.windFromDeg;

  const reported = w.condition === "clear" || w.condition === "fair" || w.condition === "partly" || w.condition === "cloudy";
  const density = reported && typeof w.cloudPct === "number" ? clamp01(0.08 + (w.cloudPct / 100) * 0.80) : p.density;
  const dark = reported && typeof w.cloudPct === "number" && w.condition === "cloudy" ? Math.max(p.dark, 0.15 + (w.cloudPct / 100) * 0.12) : p.dark;

  // forecast rain amount (mm in the next hour) makes rain stronger or lighter than the plain word
  const mmBoost = typeof w.rainMm === "number" ? clamp(0.75 + Math.min(w.rainMm, 8) / 8 * 0.5, 0.6, 1.25) : 1;
  const rain = clamp01(p.rain * (p.rain > 0 ? mmBoost : 1));
  const snow = clamp01(p.snow * (p.snow > 0 && typeof w.rainMm === "number" && w.rainMm > 1.5 ? 1.2 : 1));

  const precip = rain > 0 || snow > 0;
  const mist = !precip && p.fog === 0 && typeof w.humidityPct === "number" && w.humidityPct >= 92 && windMs < 2.5 ? 0.4 : 0;

  // colours: day to storm grey as the weather darkens or fogs over; the night versions of both
  // a heavy cover turns the sky grey (an overcast day is a grey sky, not a blue one with clouds on it)
  const overcast = clamp01((density - 0.62) / 0.24);
  const grey = clamp01(Math.max(dark, p.fog * 0.8, snow * 0.6, density * density * 0.5, overcast * 0.88));
  const dayTop = mixColor(c.dayTop, c.dayGreyTop, grey);
  const dayLow = mixColor(c.dayLow, c.dayGreyLow, grey);
  const nightTop = mixColor(c.nightTop, c.nightGreyTop, grey);
  const nightLow = mixColor(c.nightLow, c.nightGreyLow, grey);
  const cloudDay = mixColor(c.cloudDay, "#aeb6bf", clamp01(dark * 0.9));
  const cloudNight = mixColor(c.cloudNight, "#4b5567", clamp01(dark * 0.9));

  return {
    ...DEFAULT_SKY,
    density,
    dark,
    rain,
    drop: p.drop,
    snow,
    fog: p.fog,
    mist,
    lightning: p.lightning,
    sun: night ? 0 : clamp01(p.sun * (1 - density * 0.7)),
    night,
    windMs,
    windFromDeg,
    shadows: clamp01(0.85 + dark * 0.1),
    highlights: clamp01(0.75 - dark * 0.5 - p.fog * 0.3),
    skyHigh: night ? nightTop : dayTop,
    skyLow: night ? nightLow : dayLow,
    cloudColor: night ? cloudNight : cloudDay,
  };
}

/** Keeps every setting in range, so a bad value can never reach the drawing. */
export function sanitizeSky(p: WeatherSkyParams): WeatherSkyParams {
  return {
    ...p,
    density: clamp01(p.density), opacity: clamp01(p.opacity), shadows: clamp01(p.shadows), highlights: clamp01(p.highlights),
    dark: clamp01(p.dark), rain: clamp01(p.rain), drop: clamp01(p.drop), snow: clamp01(p.snow), fog: clamp01(p.fog), mist: clamp01(p.mist),
    lightning: clamp01(p.lightning), sun: clamp01(p.sun), night: clamp01(p.night),
    scale: clamp(Number.isFinite(p.scale) ? p.scale : 1, 0.25, 4),
    speed: clamp(Number.isFinite(p.speed) ? p.speed : 1, 0, 5),
    windMs: clamp(Number.isFinite(p.windMs) ? p.windMs : 0, 0, 40),
    windFromDeg: Number.isFinite(p.windFromDeg) ? ((p.windFromDeg % 360) + 360) % 360 : 0,
    rotation: Number.isFinite(p.rotation) ? p.rotation : 0,
    seed: Number.isFinite(p.seed) ? p.seed % 1000 : 7,
  };
}
