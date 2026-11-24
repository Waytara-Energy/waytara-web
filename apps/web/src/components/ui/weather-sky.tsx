"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_SKY, cloudDrift, mixColor, parseColor, precipitationLean, sanitizeSky, skyFromWeather, type SkyWeatherInput, type WeatherSkyParams } from "@/lib/weather-sky";

// A sky that follows the weather: soft layered clouds (how much, how dark, how big, which way the wind carries them), and over them rain or drizzle, snow,
// fog or mist, and thunderstorms with flashes and lightning bolts. Everything is drawn by one fragment shader, written for this project (not taken from any
// library), and every setting changes smoothly, so a change in the weather report fades from one sky into the next.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_pt;        // seconds, wrapped (rain, snow, lightning)
uniform vec2 u_off;        // how far the wind has carried the clouds
uniform float u_seed;
uniform float u_cov;       // cloud cover
uniform float u_opacity;
uniform float u_scale;
uniform float u_shadows;
uniform float u_highlights;
uniform float u_dark;
uniform float u_sun;
uniform float u_night;
uniform float u_oct;       // octaves of cloud detail (4 or 5)
uniform float u_layers;    // 1 or 2 cloud layers
uniform vec3 u_skyHigh;
uniform vec3 u_skyLow;
uniform vec3 u_cloud;
uniform vec3 u_fogCol;
uniform float u_rain;
uniform float u_drop;
uniform float u_snow;
uniform float u_fog;
uniform float u_mist;
uniform float u_lightning;
uniform float u_lean;      // rain and snow lean (wind)

const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.31, 289.17))) * 26737.367);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, float oct) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= oct) break;
    s += a * vnoise(p);
    p = R * p * 2.02 + 17.3;
    a *= 0.5;
  }
  return s;
}

// billow noise: rounded ridges, like the cauliflower tops of cumulus
float puff(vec2 p, float oct) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= oct) break;
    s += a * (1.0 - abs(2.0 * vnoise(p) - 1.0));
    p = R * p * 2.02 + 17.3;
    a *= 0.5;
  }
  return s;
}

float cloudField(vec2 q) {
  // rounded cumulus masses, with a slow change in how thick they are from place to place
  return fbm(q, min(u_oct, 4.0)) * 0.72 + puff(q, 3.0) * 0.30 + (fbm(q * 0.35 + 5.0, 2.0) - 0.5) * 0.20;
}

// ---- lightning ----

// Strikes come at pseudo-random moments; the more lightning, the shorter the gaps and the more of them happen.
// x = strength of the flash now (0 to 1), y = how far the bolt has grown down the sky (0 to 1), z = which strike (for its position and shape).
vec3 strike() {
  float period = mix(9.0, 3.6, u_lightning);
  float k = floor(u_pt / period);
  float r = hash(vec2(k, u_seed + 1.0));
  float lt = u_pt - k * period - r * period * 0.55;
  float on = step(hash(vec2(k, u_seed + 3.0)), 0.30 + 0.70 * u_lightning) * step(0.02, u_lightning);
  if (lt < 0.0 || lt > 1.0 || on < 0.5) return vec3(0.0, 0.0, k);
  float e = max(exp(-lt * 9.0), 0.85 * exp(-pow((lt - 0.17) * 13.0, 2.0)));
  e *= 0.8 + 0.2 * sin(lt * 90.0);
  float grow = clamp(lt / 0.09, 0.0, 1.0);
  return vec3(clamp(e, 0.0, 1.0), grow, k);
}

float boltPath(float y, float sd) {
  return (vnoise(vec2(y * 6.0, sd)) - 0.5) * 0.34 + (vnoise(vec2(y * 22.0, sd + 9.0)) - 0.5) * 0.06;
}

// One bolt: a jagged line from the top of the sky down to yEnd, with two thinner branches. p.x in screen-height units.
float bolt(vec2 p, float x0, float yEnd, float grow, float sd) {
  float top = 1.03;
  float len = top - yEnd;
  float r = (top - p.y) / len;                      // 0 at the top, 1 at the tip
  if (r < 0.0 || r > grow) return 0.0;
  float tip = 1.0 - smoothstep(grow - 0.06, grow, r);
  float x = x0 + boltPath(p.y, sd);
  float dx = abs(p.x - x);
  float v = exp(-dx * dx / 0.00006) + 0.35 * exp(-dx * dx / 0.0016);
  // branches
  float yb1 = yEnd + len * 0.55;
  float yb2 = yEnd + len * 0.30;
  float xb1 = x0 + boltPath(yb1, sd) + (yb1 - p.y) * 0.55 + (vnoise(vec2(p.y * 18.0, sd + 4.0)) - 0.5) * 0.05;
  float xb2 = x0 + boltPath(yb2, sd) - (yb2 - p.y) * 0.45 + (vnoise(vec2(p.y * 16.0, sd + 6.0)) - 0.5) * 0.05;
  float m1 = step(p.y, yb1) * (1.0 - smoothstep(0.10, 0.22, yb1 - p.y)) * step(r, grow);
  float m2 = step(p.y, yb2) * (1.0 - smoothstep(0.07, 0.16, yb2 - p.y)) * step(r, grow);
  float d1 = abs(p.x - xb1);
  float d2 = abs(p.x - xb2);
  v += m1 * 0.6 * (exp(-d1 * d1 / 0.00004) + 0.25 * exp(-d1 * d1 / 0.0008));
  v += m2 * 0.5 * (exp(-d2 * d2 / 0.00004) + 0.25 * exp(-d2 * d2 / 0.0008));
  return v * tip;
}

// ---- clouds ----

// One layer of cloud: xyz = colour, w = how much of the pixel it covers. flash lights the cloud from inside during lightning.
// The look is the one of a weather app: big rounded cumulus, white where they face the sun, blue-grey where another mass shades them.
vec4 cloudLayer(vec2 uv, float aspect, float freq, float spd, float shift, float haze, float flash, vec2 sunUv) {
  vec2 p = vec2(uv.x * aspect * 0.75, uv.y) * (freq / u_scale) - u_off * spd + vec2(u_seed * 1.37, u_seed * 0.71) + shift;
  vec2 w = vec2(fbm(p * 0.45 + 3.1, 2.0), fbm(p * 0.45 + 8.4, 2.0)) - 0.5;
  vec2 q = p + w * 0.8;
  float n = cloudField(q);
  float thr = mix(0.84, 0.30, u_cov);
  float edge = 0.15;
  float d = smoothstep(thr, thr + edge, n);
  if (d < 0.004) return vec4(0.0);

  // which way the sun is from this pixel (in cloud space), and how much cloud lies that way: three samples towards it
  vec2 toSun = sunUv - uv;
  vec2 L = normalize(vec2(toSun.x * aspect * 0.75, toSun.y) + vec2(0.0001)) * (1.0 / u_scale);
  float o1 = smoothstep(thr, thr + edge, cloudField(q + L * 0.07));
  float o2 = smoothstep(thr, thr + edge, cloudField(q + L * 0.17));
  float o3 = smoothstep(thr, thr + edge, cloudField(q + L * 0.34));
  float occl = clamp((o1 * 0.45 + o2 * 0.33 + o3 * 0.22) * 0.95 - 0.12, 0.0, 1.0);
  float thick = smoothstep(thr + 0.05, thr + 0.50, n);
  float lightAmt = clamp(1.0 - occl * u_shadows - thick * 0.14 * u_shadows, 0.0, 1.0);

  vec3 lit = u_cloud * (1.03 + 0.07 * u_highlights);
  vec3 shade = mix(u_cloud * 0.62, u_skyHigh * 0.86, 0.42);
  lit = mix(lit, lit * 0.80, u_dark);
  shade = mix(shade, shade * 0.62, u_dark);
  vec3 c = mix(shade, lit, smoothstep(0.0, 1.0, lightAmt));

  // bright silver edges where a mass faces the sun
  float rim = d * (1.0 - d) * 4.0;
  c += rim * u_highlights * 0.16 * lightAmt * (1.0 - u_dark * 0.7) * (0.4 + 0.6 * u_sun);
  c += vec3(0.62, 0.72, 1.0) * flash * (0.25 + 0.75 * d) * (0.55 + 0.45 * lightAmt);
  c = mix(c, u_skyLow, haze);
  return vec4(c, d * u_opacity);
}

// An overcast sheet: one muted grey-blue layer with only faint, wide, blurred streaks in it. Heavy cloud cover is drawn like this, not as separate puffs.
vec3 overcastSheet(vec2 uv, float aspect) {
  vec2 p = vec2(uv.x * aspect * 0.28 - u_off.x * 0.45, uv.y * 1.5 - u_off.y * 0.45) / u_scale + vec2(u_seed * 0.9, u_seed * 0.4);
  float n = fbm(p + (fbm(p * 0.7 + 2.0, 2.0) - 0.5) * 1.1, 4.0);
  vec3 base = mix(u_skyHigh, u_skyLow, 0.45);
  vec3 light = mix(base, u_cloud, 0.30 * (1.0 - u_dark * 0.55));
  vec3 dark = base * (0.90 - 0.10 * u_dark);
  return mix(dark, light, smoothstep(0.30, 0.72, n));
}

// Thin, stretched wisps high in the sky (the streaks of a lightly clouded day).
float wisps(vec2 uv, float aspect) {
  vec2 p = vec2(uv.x * aspect * 0.35 - u_off.x * 0.5, uv.y * 7.0 - u_off.y * 0.5) / u_scale + u_seed;
  float n = fbm(p + fbm(p * 0.6 + 4.0, 2.0) * 1.5, 4.0);
  return smoothstep(0.52, 0.82, n);
}

// ---- rain and snow ----

float rainLayer(vec2 uv, float aspect, float cells, float dens, float spd, float len, float wid, float amt, float sd) {
  vec2 p = vec2(uv.x * aspect + u_lean * uv.y, uv.y);
  float colId = floor(p.x * cells);
  float rnd = hash(vec2(colId, sd));
  float fx = fract(p.x * cells) - 0.5;
  float off = (hash(vec2(colId * 1.7, sd + 3.0)) - 0.5) * 0.5;
  float y = p.y * dens + u_pt * spd * (0.7 + 0.6 * rnd) + rnd * 13.0;
  float idx = floor(y);
  float s = fract(y);
  float gate = step(hash(vec2(colId, idx + sd * 7.0)), amt);
  float streak = clamp(1.0 - s / len, 0.0, 1.0) * smoothstep(0.0, 0.02, s);
  float line = smoothstep(wid, 0.0, abs(fx - off));
  return gate * streak * line;
}

float snowLayer(vec2 uv, float aspect, float cells, float spd, float size, float amt, float drift, float sd) {
  vec2 p = vec2(uv.x * aspect, uv.y) * cells;
  p.x -= u_pt * drift * cells;
  p.y += u_pt * spd * cells;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float r = hash(id + sd);
  float gate = step(hash(id * 1.31 + sd + 5.0), amt);
  vec2 c = vec2(0.5 + 0.26 * sin(u_pt * 0.8 + r * 20.0 + id.y), 0.2 + 0.6 * hash(id.yx + sd * 2.0));
  float rad = size * (0.6 + 0.8 * hash(id * 1.3 + sd));
  float dd = length(f - c);
  return gate * smoothstep(rad, rad * 0.02, dd);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 uv = v_uv;
  vec2 p0 = vec2(uv.x * aspect, uv.y);

  vec3 st = u_lightning > 0.02 ? strike() : vec3(0.0);
  float flash = st.x;

  // the sky: deeper blue at the top, lighter towards the horizon
  vec3 col = mix(u_skyLow, u_skyHigh, smoothstep(0.0, 1.0, pow(uv.y, 0.8)));
  col = mix(col, u_skyLow * 1.04 + 0.02, smoothstep(0.30, 0.0, uv.y) * 0.35);

  // the sun: a bright core, a wide glow, a faint halo ring and soft rays (all fade behind cloud and in bad weather)
  vec2 sunUv = vec2(0.30, 0.95);
  vec2 sunPos = vec2(aspect * sunUv.x, sunUv.y);
  float sd = length(p0 - sunPos);
  float clearness = u_sun * (1.0 - u_dark * 0.8);
  float core = exp(-sd * sd * 1100.0) * 1.3;
  float glow = exp(-sd * sd * 4.0) * 0.50 + exp(-sd * 1.8) * 0.20;
  col += vec3(1.0, 0.97, 0.88) * (core + glow) * clearness;
  float ring = exp(-pow((sd - 0.50) / 0.04, 2.0));
  col += mix(vec3(0.95, 0.60, 0.55), vec3(0.55, 0.70, 1.0), clamp((sd - 0.45) / 0.10, 0.0, 1.0)) * ring * 0.09 * clearness * (1.0 - u_cov * 0.6);
  float ang = atan(p0.y - sunPos.y, p0.x - sunPos.x);
  float rayN = vnoise(vec2(ang * 7.0, u_seed)) * 0.6 + vnoise(vec2(ang * 19.0, u_seed + 3.0)) * 0.4;
  float rayMix = 0.35 + 0.65 * smoothstep(0.1, 0.45, u_cov) * (1.0 - smoothstep(0.7, 0.95, u_cov));
  col += vec3(1.0, 0.97, 0.90) * pow(rayN, 2.2) * exp(-sd * 1.5) * 0.30 * clearness * rayMix;
  col += vec3(0.50, 0.58, 0.80) * flash * 0.22;

  // wisps on a lightly clouded day
  float wisp = (1.0 - u_dark) * smoothstep(0.03, 0.25, u_cov) * (1.0 - smoothstep(0.55, 0.9, u_cov));
  if (wisp > 0.02) {
    col = mix(col, u_cloud, wisps(uv, aspect) * wisp * 0.55 * smoothstep(0.35, 0.9, uv.y + 0.1));
  }

  // heavy cover: the overcast sheet (the puffs below are then only faintly there)
  float overcast = smoothstep(0.62, 0.86, u_cov);
  if (overcast > 0.01) {
    col = mix(col, overcastSheet(uv, aspect), overcast * 0.94 * u_opacity);
  }

  // clouds: a far, hazy, slower layer and a near one
  if (u_cov > 0.01) {
    if (u_layers > 1.5) {
      vec4 b = cloudLayer(uv, aspect, 2.4, 0.55, 40.0, 0.30, flash, sunUv);
      col = mix(col, b.rgb, b.a * 0.92 * (1.0 - overcast * 0.80));
    }
    vec4 f = cloudLayer(uv, aspect, 1.45, 1.0, 0.0, 0.0, flash, sunUv);
    col = mix(col, f.rgb, f.a * (1.0 - overcast * 0.72));
  }

  // fog thickens the whole view and is heaviest near the ground; mist is a thin low haze that drifts sideways
  if (u_fog > 0.01 || u_mist > 0.01) {
    float fq = fbm(vec2(uv.x * aspect * 1.1, uv.y * 1.3) / u_scale * 1.4 - u_off * 0.8 + u_seed, 3.0);
    float fogAmt = u_fog * (0.78 + 0.5 * fq) * (0.62 + 0.38 * (1.0 - uv.y));
    col = mix(col, u_fogCol, clamp(fogAmt, 0.0, 0.97));
    float mq = fbm(vec2(uv.x * aspect * 0.7, uv.y * 4.5) - u_off * vec2(1.6, 0.0) + u_seed * 2.0, 3.0);
    float mistAmt = u_mist * smoothstep(0.85, 0.0, uv.y) * (0.35 + 0.8 * mq);
    col = mix(col, u_fogCol, clamp(mistAmt, 0.0, 0.85));
  }

  // lightning bolt
  if (flash > 0.01 && u_lightning > 0.25) {
    float x0 = aspect * (0.18 + 0.64 * hash(vec2(st.z, u_seed + 7.0)));
    float yEnd = 0.18 + 0.28 * hash(vec2(st.z, u_seed + 11.0));
    float b = bolt(p0, x0, yEnd, st.y, u_seed + st.z * 3.1);
    col += vec3(0.82, 0.88, 1.0) * b * (0.55 + 0.45 * flash) * (0.5 + 0.5 * smoothstep(0.25, 0.6, u_lightning));
  }

  // rain and drizzle: three depths, finer and fainter far away, longer and faster near
  if (u_rain > 0.01) {
    float dr = u_drop;
    float amt = u_rain;
    float r = 0.0;
    float a = 0.25 + 0.75 * amt;
    r += rainLayer(uv, aspect, mix(190.0, 100.0, dr), mix(3.2, 2.8, dr), mix(0.9, 2.0, dr), mix(0.09, 0.12, dr), mix(0.09, 0.15, dr), a * 0.9, 11.0) * 0.45;
    r += rainLayer(uv, aspect, mix(130.0, 64.0, dr), mix(3.0, 2.5, dr), mix(1.1, 2.5, dr), mix(0.10, 0.15, dr), mix(0.10, 0.18, dr), a * 0.8, 23.0) * 0.65;
    r += rainLayer(uv, aspect, mix(85.0, 40.0, dr), mix(2.8, 2.3, dr), mix(1.3, 3.0, dr), mix(0.11, 0.19, dr), mix(0.11, 0.20, dr), a * 0.7, 37.0) * 0.9;
    vec3 rainCol = mix(vec3(0.80, 0.87, 0.96), vec3(0.50, 0.58, 0.72), u_night);
    col = mix(col, col * 0.88, clamp(u_rain, 0.0, 1.0) * 0.5);
    col += rainCol * r * (0.42 + 0.20 * dr);
  }

  // snow: three depths of flakes, swaying and leaning with the wind
  if (u_snow > 0.01) {
    float s = 0.0;
    float dft = u_lean * 0.5;
    s += snowLayer(uv, aspect, 52.0, 0.018, 0.09, u_snow * 0.9, dft * 0.6, 3.0) * 0.5;
    s += snowLayer(uv, aspect, 30.0, 0.030, 0.11, u_snow * 0.8, dft * 0.8, 17.0) * 0.75;
    s += snowLayer(uv, aspect, 17.0, 0.048, 0.13, u_snow * 0.65, dft, 29.0);
    col = mix(col, vec3(dot(col, vec3(0.333))) * 0.9 + 0.08, u_snow * 0.25);
    col += vec3(0.95, 0.97, 1.0) * s * mix(0.95, 0.55, u_night);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV !== "production") console.error("weather-sky shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Smooth = { [K in "density" | "opacity" | "scale" | "shadows" | "highlights" | "dark" | "rain" | "drop" | "snow" | "fog" | "mist" | "lightning" | "sun" | "night" | "lean" | "driftX" | "driftY" | "speed"]: number } & {
  skyHigh: [number, number, number];
  skyLow: [number, number, number];
  cloud: [number, number, number];
  fogCol: [number, number, number];
};

function targetOf(p: WeatherSkyParams): Smooth {
  const drift = cloudDrift(p.windFromDeg, p.windMs, 1, p.rotation);
  // fog and mist are the colour of the sky's low end, washed out; by night they are dark
  const fogCol = parseColor(mixColor(mixColor(p.skyLow, "#d5dade", 0.6), "#2b3442", p.night * 0.8));
  return {
    density: p.density, opacity: p.opacity, scale: p.scale, shadows: p.shadows, highlights: p.highlights, dark: p.dark, rain: p.rain, drop: p.drop,
    snow: p.snow, fog: p.fog, mist: p.mist, lightning: p.lightning, sun: p.sun, night: p.night,
    lean: precipitationLean(p.windFromDeg, p.windMs), driftX: drift.x, driftY: drift.y, speed: p.speed,
    skyHigh: parseColor(p.skyHigh), skyLow: parseColor(p.skyLow), cloud: parseColor(p.cloudColor), fogCol,
  };
}

const NUM_KEYS = ["density", "opacity", "scale", "shadows", "highlights", "dark", "rain", "drop", "snow", "fog", "mist", "lightning", "sun", "night", "lean", "driftX", "driftY", "speed"] as const;
const COL_KEYS = ["skyHigh", "skyLow", "cloud", "fogCol"] as const;

export interface WeatherSkyProps {
  /** Settings to apply on top of the defaults (and on top of the weather report, if one is given). */
  params?: Partial<WeatherSkyParams>;
  /** A weather report (lib/weather's WeatherNow fits): the sky is set from it. `params` then adjusts it. */
  weather?: SkyWeatherInput;
  className?: string;
  children?: React.ReactNode;
  /** "high" draws two cloud layers with five octaves of detail; "low" is one layer with four, about three times cheaper. */
  quality?: "high" | "low";
  /** The most device pixels drawn per CSS pixel (default 2; 1 is much cheaper on a high-density screen and clouds are soft). */
  maxPixelRatio?: number;
  /** Seconds a change takes to fade in (default 1.6). */
  fadeSeconds?: number;
}

export function WeatherSky({ params, weather, className, children, quality = "high", maxPixelRatio = 2, fadeSeconds = 1.6 }: WeatherSkyProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const target = React.useMemo(() => {
    const base = weather ? skyFromWeather(weather) : DEFAULT_SKY;
    return sanitizeSky({ ...base, ...(params ?? {}) } as WeatherSkyParams);
  }, [params, weather]);

  // Kept current from an effect (not written during render), so the draw loop always reads the latest settings.
  const live = React.useRef({ target, seed: target.seed, quality, maxPixelRatio, fadeSeconds });
  React.useEffect(() => {
    live.current = { target, seed: target.seed, quality, maxPixelRatio, fadeSeconds };
  }, [target, quality, maxPixelRatio, fadeSeconds]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, "a_pos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const loc = {
      res: u("u_res"), pt: u("u_pt"), off: u("u_off"), seed: u("u_seed"), cov: u("u_cov"), opacity: u("u_opacity"), scale: u("u_scale"), shadows: u("u_shadows"),
      highlights: u("u_highlights"), dark: u("u_dark"), sun: u("u_sun"), night: u("u_night"), oct: u("u_oct"), layers: u("u_layers"), skyHigh: u("u_skyHigh"),
      skyLow: u("u_skyLow"), cloud: u("u_cloud"), fogCol: u("u_fogCol"), rain: u("u_rain"), drop: u("u_drop"), snow: u("u_snow"), fog: u("u_fog"),
      mist: u("u_mist"), lightning: u("u_lightning"), lean: u("u_lean"),
    };

    // The smoothed state the drawing actually uses; it eases towards the target a little each frame.
    const cur: Smooth = targetOf(live.current.target);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let off = [0, 0];
    let pt = 0;
    let last = performance.now();
    let frame = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, live.current.maxPixelRatio);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(loc.res, w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      const L = live.current;
      const tgt = targetOf(L.target);
      const k = 1 - Math.exp(-dt / Math.max(0.05, L.fadeSeconds));
      for (const key of NUM_KEYS) cur[key] += (tgt[key] - cur[key]) * k;
      for (const key of COL_KEYS) for (let i = 0; i < 3; i++) cur[key][i] += (tgt[key][i] - cur[key][i]) * k;

      if (!reduceMotion) {
        off = [off[0] + cur.driftX * cur.speed * dt, off[1] + cur.driftY * cur.speed * dt];
        pt = (pt + dt * cur.speed) % 1000;
      }

      gl.uniform1f(loc.pt, pt);
      gl.uniform2f(loc.off, off[0], off[1]);
      gl.uniform1f(loc.seed, ((L.seed % 1000) + 1000) % 1000 * 0.13);
      gl.uniform1f(loc.cov, cur.density);
      gl.uniform1f(loc.opacity, cur.opacity);
      gl.uniform1f(loc.scale, cur.scale);
      gl.uniform1f(loc.shadows, cur.shadows);
      gl.uniform1f(loc.highlights, cur.highlights);
      gl.uniform1f(loc.dark, cur.dark);
      gl.uniform1f(loc.sun, cur.sun);
      gl.uniform1f(loc.night, cur.night);
      gl.uniform1f(loc.oct, L.quality === "low" ? 4 : 5);
      gl.uniform1f(loc.layers, L.quality === "low" ? 1 : 2);
      gl.uniform3f(loc.skyHigh, cur.skyHigh[0], cur.skyHigh[1], cur.skyHigh[2]);
      gl.uniform3f(loc.skyLow, cur.skyLow[0], cur.skyLow[1], cur.skyLow[2]);
      gl.uniform3f(loc.cloud, cur.cloud[0], cur.cloud[1], cur.cloud[2]);
      gl.uniform3f(loc.fogCol, cur.fogCol[0], cur.fogCol[1], cur.fogCol[2]);
      gl.uniform1f(loc.rain, cur.rain);
      gl.uniform1f(loc.drop, cur.drop);
      gl.uniform1f(loc.snow, cur.snow);
      gl.uniform1f(loc.fog, cur.fog);
      gl.uniform1f(loc.mist, cur.mist);
      gl.uniform1f(loc.lightning, cur.lightning);
      gl.uniform1f(loc.lean, cur.lean);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    // Stop drawing while the sky is scrolled out of view, and carry on from the same moment when it comes back.
    let pausedAt: number | null = null;
    const visibility = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (entry.isIntersecting) {
        if (pausedAt !== null) {
          last = performance.now();
          pausedAt = null;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(draw);
        }
      } else if (pausedAt === null) {
        pausedAt = performance.now();
        cancelAnimationFrame(frame);
      }
    });
    visibility.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, []);

  return (
    <div className={cn("relative h-full min-h-80 w-full overflow-hidden", className)}>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      {children ? <div className="relative z-10 flex h-full w-full items-center justify-center">{children}</div> : null}
    </div>
  );
}
