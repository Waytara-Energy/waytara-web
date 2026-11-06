// Made-up figures for the dashboard demo on the website: a home with solar, a battery, the grid, an inverter and an EV charger, and a second site with four
// EV chargers. Nothing here comes from a customer or a device. Everything is computed from smooth curves of the time of day in India, so the demo follows the
// real clock (call the builders again every few seconds and the right end of every curve moves on), and looks the same for every visitor at the same time.

const IST_MS = 19_800_000;
const HOUR_MS = 3_600_000;
const SLOT_H = 0.25; // one point every 15 minutes
const BATTERY_KWH = 10;

/** Before the page has started its clock (the first paint, and the server), the demo shows this fixed afternoon so both sides draw the same thing. */
const STATIC_DAY_START = Date.UTC(2026, 5, 15) - IST_MS;
const STATIC_NOW_HOUR = 14.25;

export const SAMPLE_SITE = "My Home";
export const SAMPLE_DEVICE = "Hybrid Inverter 8 kW";

export type SeriesPoint = [number, number];

/** Midnight in India for the day of `ms`, and how many hours of that day have passed (fractions included). */
export function istDay(ms: number): { dayStart: number; hour: number } {
  const local = ms + IST_MS;
  const dayStartLocal = Math.floor(local / (24 * HOUR_MS)) * 24 * HOUR_MS;
  return { dayStart: dayStartLocal - IST_MS, hour: (local - dayStartLocal) / HOUR_MS };
}

function when(nowMs: number | null): { dayStart: number; hour: number } {
  return nowMs === null ? { dayStart: STATIC_DAY_START, hour: STATIC_NOW_HOUR } : istDay(nowMs);
}

/** The clock time of an hour of the day ("2:15 PM"). */
export function hourClock(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

const gauss = (h: number, centre: number, width: number) => Math.exp(-(((h - centre) / width) ** 2));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** The hours a day is sampled at: a point at the start of every 15-minute slot so far, then one at this very moment. */
function sampleHours(nowHour: number): { t: number; h: number; dt: number }[] {
  const slots = Math.floor(nowHour / SLOT_H);
  const out: { t: number; h: number; dt: number }[] = [];
  for (let i = 0; i < slots; i++) out.push({ t: i * SLOT_H, h: i * SLOT_H + SLOT_H / 2, dt: SLOT_H });
  out.push({ t: nowHour, h: nowHour, dt: Math.max(0, nowHour - slots * SLOT_H) });
  return out;
}

// ------------------------------------------------------------------------------------------------ the home: solar, battery, load, grid

export interface DemoData {
  site: string;
  /** Midnight at the start of the day (epoch ms): the left end of every curve. */
  dayStart: number;
  /** The end of the data (epoch ms): the right end of every curve. */
  now: number;
  /** The newest reading's time (epoch ms). */
  at: number;
  /** The newest value of each reading. */
  live: Record<string, number>;
  /** key -> [time (epoch ms), value], one point every 15 minutes and one at this moment. */
  series: Record<string, SeriesPoint[]>;
}

export const sunAt = (h: number) => (h < 6 || h > 18.6 ? 0 : Math.pow(Math.sin((Math.PI * (h - 6)) / 12.6), 1.3));

export function buildSampleData(nowMs: number | null = null): DemoData {
  const { dayStart, hour: nowHour } = when(nowMs);
  const series: Record<string, SeriesPoint[]> = {};
  const push = (key: string, t: number, v: number) => (series[key] ??= []).push([t, v]);
  const live: Record<string, number> = {};

  let soc = 40;
  let pvE = 0;
  let loadE = 0;
  let chargeE = 0;
  let dischargeE = 0;
  let importE = 0;
  let exportE = 0;
  let activeE = 0;

  for (const { t: th, h, dt } of sampleHours(nowHour)) {
    const t = dayStart + th * HOUR_MS;
    const sun = sunAt(h);
    // a little cloud now and then, and a flicker that moves every few seconds, so the curve is not a perfect bell
    const haze = 0.9 + 0.06 * Math.sin(h * 5.1) + 0.03 * Math.sin(h * 12.7) + 0.015 * Math.sin(h * 210) - (h > 10.2 && h < 11 ? 0.12 : 0);
    const solarKw = 5.6 * sun * haze;
    const loadKw = 0.42 + 0.55 * gauss(h, 7.6, 1.1) + 0.55 * gauss(h, 13.2, 2.4) + 1.2 * gauss(h, 20.3, 1.5) + 0.05 * Math.sin(h * 7.3) + 0.02 * Math.sin(h * 190);

    // the battery takes the surplus (easing off as it fills) and covers the shortfall down to a reserve (positive = charging)
    const surplus = solarKw - loadKw;
    const taper = soc < 80 ? 1 : Math.max(0.08, (100 - soc) / 20);
    let batteryKw = 0;
    if (surplus > 0.05 && soc < 99) batteryKw = Math.min(surplus, 2.6 * taper);
    else if (surplus < -0.05 && soc > 20) batteryKw = -Math.min(-surplus, 2.6);
    soc = Math.min(100, Math.max(0, soc + ((batteryKw * dt) / BATTERY_KWH) * 100));

    const chargeKw = Math.max(batteryKw, 0);
    const dischargeKw = Math.max(-batteryKw, 0);
    // the inverter's AC output is the solar plus whatever the battery gives; the rest of the house comes from the grid (negative = exporting)
    const outKw = solarKw + dischargeKw;
    const gridKw = loadKw + chargeKw - outKw;

    pvE += solarKw * dt;
    loadE += loadKw * dt;
    activeE += outKw * dt;
    if (batteryKw > 0) chargeE += batteryKw * dt;
    else dischargeE += -batteryKw * dt;
    if (gridKw > 0) importE += gridKw * dt;
    else exportE += -gridKw * dt;

    const pv1W = solarKw * 560;
    const pv2W = solarKw * 440;
    const volts = 230 + 2.5 * Math.sin(h * 3.1) + 0.4 * Math.sin(h * 230);
    const pv1V = sun > 0 ? 418 + 14 * sun : 0;
    const pv2V = sun > 0 ? 405 + 12 * sun : 0;
    const battV = 48 + (4 * soc) / 100;

    const values: Record<string, number> = {
      inverter_output_power_w: outKw * 1000,
      pv1_power_w: pv1W,
      pv2_power_w: pv2W,
      load_total_power_w: loadKw * 1000,
      grid_total_power_w: gridKw * 1000,
      battery_power_w: batteryKw * 1000,
      battery_soc_pct: soc,
      load_l1_current_a: (loadKw * 1000) / volts,
      day_pv_energy_kwh: pvE,
      day_load_energy_kwh: loadE,
      day_active_energy_kwh: activeE,
      day_battery_charge_energy_kwh: chargeE,
      day_battery_discharge_energy_kwh: dischargeE,
      day_grid_import_energy_kwh: importE,
      day_grid_export_energy_kwh: exportE,
    };
    for (const [key, v] of Object.entries(values)) push(key, t, round(v, 3));

    // the figures only the "live" cards show (the last pass is this moment)
    Object.assign(live, values, {
      inverter_l1_voltage_v: volts,
      inverter_l1_current_a: (outKw * 1000) / volts,
      inverter_output_frequency_hz: 49.98 + 0.03 * Math.sin(h * 9),
      inverter_ac_temperature_c: 34 + 9 * sun,
      inverter_dc_temperature_c: 38 + 15 * sun,
      pv1_voltage_v: pv1V,
      pv1_current_a: pv1V > 0 ? pv1W / pv1V : 0,
      pv2_voltage_v: pv2V,
      pv2_current_a: pv2V > 0 ? pv2W / pv2V : 0,
      battery_temperature_c: 26.5 + 2 * sun,
      battery_voltage_v: battV,
      battery_current_a: (batteryKw * 1000) / battV,
      load_l1_power_w: loadKw * 1000,
      load_l1_voltage_v: volts,
      load_frequency_hz: 49.98,
      grid_l1_voltage_v: volts + 1,
      grid_l1_current_a: (Math.abs(gridKw) * 1000) / volts,
      grid_frequency_hz: 49.98,
      grid_ct_total_power_w: gridKw * 1000,
      grid_ct_l1_current_a: (Math.abs(gridKw) * 1000) / volts,
    });
  }

  const now = dayStart + nowHour * HOUR_MS;
  return { site: SAMPLE_SITE, dayStart, now, at: now - 60_000, live, series };
}

// ------------------------------------------------------------------------------------------------ the sites and their devices

export type DeviceKind = "inverter" | "charger";

export interface SampleDevice {
  id: string;
  kind: DeviceKind;
  name: string;
  /** Chargers only. */
  ratedKw?: number;
  /** Chargers only: when it charges, as [from hour, to hour, kW] (a charge that has not started yet is just waiting). */
  windows?: [number, number, number][];
  /** Chargers only: whether the solar and battery of the site can power it. */
  solar?: boolean;
  /** Chargers only: what a driver pays for each kWh (rupees); a charger with one shows what it has earned today. */
  tariff?: number;
}

export interface SampleSite {
  id: string;
  name: string;
  devices: SampleDevice[];
}

export const SAMPLE_SITES: SampleSite[] = [
  {
    id: "home",
    name: "My Home",
    devices: [
      { id: "inverter", kind: "inverter", name: SAMPLE_DEVICE },
      {
        id: "ev-home",
        kind: "charger",
        name: "DUO 7.4 kW",
        ratedKw: 7.4,
        solar: true,
        windows: [
          [6.75, 7.75, 7.0],
          [12.13, 17.5, 7.1],
          [21.0, 23.5, 6.8],
        ],
      },
    ],
  },
  {
    id: "hub",
    name: "Charging Hub",
    devices: [
      {
        id: "hub-1",
        kind: "charger",
        name: "DUO 7.4 kW A",
        ratedKw: 7.4,
        tariff: 18,
        // the busiest charger of the hub: a charge after another through the day, with a few minutes between them
        windows: [[0.4, 2.3, 7.2], [2.4, 4.3, 7.1], [4.4, 6.3, 7.3], [6.4, 8.3, 7.2], [8.4, 10.3, 7.1], [10.4, 12.3, 7.3], [12.4, 14.3, 7.2], [14.4, 16.3, 7.1], [16.4, 18.3, 7.3], [18.4, 20.3, 7.2], [20.4, 22.3, 7.1], [22.4, 23.9, 7.2]],
      },
      { id: "hub-2", kind: "charger", name: "DUO 11 kW", ratedKw: 11, tariff: 18, windows: [[7.5, 9, 10.4], [12, 15.6, 10.8], [19, 22, 10.5]] },
      { id: "hub-3", kind: "charger", name: "DUO 22 kW", ratedKw: 22, tariff: 24, windows: [[9, 10.2, 21], [14, 16.5, 21.5], [20, 23.5, 20.8]] },
      { id: "hub-4", kind: "charger", name: "DUO 7.4 kW B", ratedKw: 7.4, tariff: 18, windows: [[10, 12.5, 7.2], [17, 19.5, 7.1]] },
    ],
  },
];

// ------------------------------------------------------------------------------------------------ an EV charger

/** A charge started or stopped by hand in the demo (nothing is sent anywhere): from the hour `at` on. A stop also says which charge window it ended (-1 for none). */
export interface EvEvent {
  mode: "start" | "stop";
  at: number;
  window: number;
}

export interface EvSample {
  running: boolean;
  ratedKw: number;
  /** The live reading while a charge runs (zero when none does). */
  kw: number;
  amps: number;
  volts: number;
  /** The running charge so far (kWh), its target (null when none is set) and how long it has run (minutes). */
  sessionKwh: number;
  targetKwh: number | null;
  elapsedMin: number;
  /** Where the energy of the running charge comes from (percent, adding to 100). */
  shares: { key: "solar" | "battery" | "grid"; label: string; pct: number }[];
  /** Everything the charger delivered today (kWh). */
  deliveredToday: number;
  /** The charger's power, one point every 15 minutes and one at this moment. */
  series: SeriesPoint[];
  /** Today's charges, newest first. */
  charges: { start: string; kwh: number; running: boolean }[];
  /** How many charges today, how long the charger has been charging in all (minutes), its strongest power (kW) and, for a charger with a tariff, what it has earned (rupees). */
  sessionsToday: number;
  chargingMin: number;
  peakKw: number;
  tariff: number | null;
  earnings: number | null;
  /** Text for the first tile when nothing is charging ("Last charge 7.0 kWh, 7:42 AM"), or null. */
  lastCharge: string | null;
}

function chargerPower(def: SampleDevice, h: number, events: EvEvent[]): number {
  const wins = def.windows ?? [];
  const idx = wins.findIndex(([from, to]) => h >= from && h <= to);
  let manual = false;
  const stopped = new Set<number>();
  for (const e of events) {
    if (e.at > h) break;
    if (e.mode === "start") manual = true;
    else {
      manual = false;
      if (e.window >= 0) stopped.add(e.window);
    }
  }
  const scheduled = idx >= 0 && !stopped.has(idx);
  if (!scheduled && !manual) return 0;
  const rated = def.ratedKw ?? 7.4;
  const level = idx >= 0 ? wins[idx][2] : rated * 0.96;
  return level + 0.04 * level * Math.sin(h * 37);
}

export function buildCharger(def: SampleDevice, nowMs: number | null, events: EvEvent[] = []): EvSample {
  const { dayStart, hour: nowHour } = when(nowMs);
  const rated = def.ratedKw ?? 7.4;

  // the day minute by minute: the energy, and when each charge began and ended
  const minutes = Math.max(1, Math.ceil(nowHour * 60));
  const perMinute: number[] = [];
  const runs: { from: number; kwh: number; open: boolean }[] = [];
  let current: { from: number; kwh: number; open: boolean } | null = null;
  let total = 0;
  let onMinutes = 0;
  let peak = 0;
  for (let m = 0; m < minutes; m++) {
    const h0 = m / 60;
    // the last minute is read at this very moment, so a start or stop made now shows at once
    const h = m === minutes - 1 ? nowHour : Math.min(nowHour, h0 + 0.5 / 60);
    const span = Math.min(1 / 60, nowHour - h0);
    const kw = span > 0 ? chargerPower(def, h, events) : 0;
    perMinute.push(kw);
    total += kw * span;
    if (kw > 0.05) {
      onMinutes += span * 60;
      peak = Math.max(peak, kw);
      if (!current) {
        current = { from: h0, kwh: 0, open: true };
        runs.push(current);
      }
      current.kwh += kw * span;
    } else if (current) {
      current.open = false;
      current = null;
    }
  }
  const running = current !== null;

  // the chart: the average power of every 15-minute slot, and the power at this moment
  const series: SeriesPoint[] = [];
  const slots = Math.floor(nowHour / SLOT_H);
  for (let i = 0; i < slots; i++) {
    const from = Math.round(i * SLOT_H * 60);
    const part = perMinute.slice(from, from + Math.round(SLOT_H * 60));
    series.push([dayStart + i * SLOT_H * HOUR_MS, round(part.reduce((x, y) => x + y, 0) / Math.max(1, part.length), 3)]);
  }
  const latest = perMinute[perMinute.length - 1] ?? 0;
  series.push([dayStart + nowHour * HOUR_MS, round(latest, 3)]);

  const finished = runs.filter((r) => !(running && r.open));
  const lastDone = finished[finished.length - 1];
  const open = running ? runs[runs.length - 1] : null;
  const sunNow = sunAt(nowHour);
  const solarPct = def.solar ? Math.round(Math.min(90, 100 * Math.min(1, (5.6 * sunNow) / rated))) : 0;
  const batteryPct = def.solar && solarPct > 0 ? 9 : 0;
  const shares = [
    { key: "solar" as const, label: "Solar", pct: solarPct },
    { key: "battery" as const, label: "Battery", pct: batteryPct },
    { key: "grid" as const, label: "Grid", pct: 100 - solarPct - batteryPct },
  ];
  const volts = 229 + 1.2 * Math.sin(nowHour * 53);
  return {
    running,
    ratedKw: rated,
    kw: running ? latest : 0,
    amps: running ? Math.round((latest * 1000) / volts / (rated > 11 ? 3 : 1)) : 0,
    volts: Math.round(volts),
    sessionKwh: open ? round(open.kwh, 1) : 0,
    targetKwh: open && def.solar ? 24 : null,
    elapsedMin: open ? Math.max(0, Math.round((nowHour - open.from) * 60)) : 0,
    shares,
    deliveredToday: round(total, 1),
    sessionsToday: runs.length,
    chargingMin: Math.round(onMinutes),
    peakKw: round(peak, 1),
    tariff: def.tariff ?? null,
    earnings: def.tariff ? Math.round(total * def.tariff) : null,
    series,
    charges: runs.map((r) => ({ start: hourClock(r.from), kwh: round(r.kwh, 1), running: running && r.open })).reverse(),
    lastCharge: lastDone ? `Last charge ${round(lastDone.kwh, 1).toFixed(1)} kWh, ${hourClock(lastDone.from)}` : null,
  };
}

// ------------------------------------------------------------------------------------------------ the weather

export type SampleCondition = "clear" | "fair" | "partly" | "cloudy" | "rain";

export interface SampleWeather {
  tempC: number;
  feelsC: number;
  condition: SampleCondition;
  night: boolean;
  humidityPct: number;
  windKmh: number;
  text: string;
  /** The next six hours. */
  hours: { hour: number; tempC: number; condition: SampleCondition; night: boolean }[];
  /** A line about what the sky means for solar. */
  outlook: string;
}

const CONDITION_TEXT: Record<SampleCondition, string> = { clear: "Clear", fair: "Mostly sunny", partly: "Partly cloudy", cloudy: "Cloudy", rain: "Light rain" };

function conditionAt(h: number): SampleCondition {
  if (h < 6 || h >= 19) return "clear";
  if (h < 11) return "fair";
  if (h < 16) return "partly";
  if (h < 17.75) return "rain";
  return "cloudy";
}

export function weatherAt(nowMs: number | null): SampleWeather {
  const { hour } = when(nowMs);
  const temp = (h: number) => 29.5 + 3.5 * Math.sin((Math.PI * (h - 9)) / 12);
  const cond = conditionAt(hour);
  const night = hour < 6 || hour >= 19;
  const hours = Array.from({ length: 6 }, (_, i) => {
    const h = (Math.floor(hour) + i + 1) % 24;
    return { hour: h, tempC: Math.round(temp(h)), condition: conditionAt(h), night: h < 6 || h >= 19 };
  });
  const rainSoon = hours.some((x) => x.condition === "rain");
  return {
    tempC: Math.round(temp(hour)),
    feelsC: Math.round(temp(hour) + 3),
    condition: cond,
    night,
    humidityPct: Math.round(66 + 14 * Math.cos((Math.PI * (hour - 4)) / 12)),
    windKmh: Math.round(11 + 4 * Math.sin(hour * 0.6)),
    text: CONDITION_TEXT[cond],
    hours,
    outlook: night ? "No sun until the morning." : rainSoon ? "A little rain is expected; solar dips for an hour or so." : cond === "cloudy" ? "Cloud keeps solar below its best." : "Good sun for solar.",
  };
}
