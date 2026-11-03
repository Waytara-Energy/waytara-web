// Sample figures for the dashboard demo on the landing page: one plausible day at a home with solar, a battery and the grid. Nothing
// here comes from a customer or a device - it is computed from smooth curves, so it looks the same for every visitor.

const IST_MS = 19_800_000;
const HOUR_MS = 3_600_000;
const SLOT_MS = 900_000; // 15 minutes
const SLOT_H = 0.25;
/** A fixed sample day (midnight in India), so the clock labels read the same wherever the visitor is. */
const DAY_START = Date.UTC(2026, 5, 15) - IST_MS;
/** How far into the day the sample has got: 2:15 PM. */
const NOW_HOUR = 14.25;
const BATTERY_KWH = 10;

export const SAMPLE_SITE = "Sample Home";
export const SAMPLE_DEVICE = "Hybrid Inverter 8 kW";

export type SeriesPoint = [number, number];

export interface DemoData {
  site: string;
  /** Midnight at the start of the sample day (epoch ms): the left end of every curve. */
  dayStart: number;
  /** The end of the data (epoch ms): the right end of every curve. */
  now: number;
  /** The newest reading's time (epoch ms). */
  at: number;
  /** The newest value of each reading. */
  live: Record<string, number>;
  /** key -> [slot start (epoch ms), value], one point every 15 minutes. */
  series: Record<string, SeriesPoint[]>;
}

const gauss = (h: number, centre: number, width: number) => Math.exp(-(((h - centre) / width) ** 2));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

let cached: DemoData | null = null;

export function buildSampleData(): DemoData {
  if (cached) return cached;
  const slots = Math.round(NOW_HOUR / SLOT_H);
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

  for (let i = 0; i < slots; i++) {
    const h = (i + 0.5) * SLOT_H;
    const t = DAY_START + i * SLOT_MS;

    const sun = h < 6 || h > 18.6 ? 0 : Math.pow(Math.sin((Math.PI * (h - 6)) / 12.6), 1.3);
    // a little cloud now and then, so the curve is not a perfect bell
    const haze = 0.9 + 0.06 * Math.sin(h * 5.1) + 0.03 * Math.sin(h * 12.7) - (h > 10.2 && h < 11 ? 0.12 : 0);
    const solarKw = 5.6 * sun * haze;
    const loadKw = 0.42 + 0.55 * gauss(h, 7.6, 1.1) + 0.55 * gauss(h, 13.2, 2.4) + 1.2 * gauss(h, 20.3, 1.5) + 0.05 * Math.sin(h * 7.3);

    // the battery takes the surplus (easing off as it fills) and covers the shortfall down to a reserve (positive = charging)
    const surplus = solarKw - loadKw;
    const taper = soc < 80 ? 1 : Math.max(0.08, (100 - soc) / 20);
    let batteryKw = 0;
    if (surplus > 0.05 && soc < 99) batteryKw = Math.min(surplus, 2.6 * taper);
    else if (surplus < -0.05 && soc > 20) batteryKw = -Math.min(-surplus, 2.6);
    soc = Math.min(100, Math.max(0, soc + ((batteryKw * SLOT_H) / BATTERY_KWH) * 100));

    const chargeKw = Math.max(batteryKw, 0);
    const dischargeKw = Math.max(-batteryKw, 0);
    // the inverter's AC output is the solar plus whatever the battery gives; the rest of the house comes from the grid (negative = exporting)
    const outKw = solarKw + dischargeKw;
    const gridKw = loadKw + chargeKw - outKw;

    pvE += solarKw * SLOT_H;
    loadE += loadKw * SLOT_H;
    activeE += outKw * SLOT_H;
    if (batteryKw > 0) chargeE += batteryKw * SLOT_H;
    else dischargeE += -batteryKw * SLOT_H;
    if (gridKw > 0) importE += gridKw * SLOT_H;
    else exportE += -gridKw * SLOT_H;

    const pv1W = solarKw * 560;
    const pv2W = solarKw * 440;
    const volts = 230 + 2.5 * Math.sin(h * 3.1);
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

    // the figures only the "live" cards show
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

  const now = DAY_START + NOW_HOUR * HOUR_MS;
  cached = { site: SAMPLE_SITE, dayStart: DAY_START, now, at: now - 2 * 60_000, live, series };
  return cached;
}

/** Re-bucket a 15-minute series into wider intervals: the average of each (power) or the last value of each (a running total). */
export function bucketSeries(points: SeriesPoint[], minutes: number, mode: "avg" | "last" = "avg"): SeriesPoint[] {
  if (minutes <= 15) return points;
  const span = minutes * 60_000;
  const out: SeriesPoint[] = [];
  let bucket = -1;
  let sum = 0;
  let count = 0;
  let latest = 0;
  const flush = () => {
    if (bucket >= 0 && count > 0) out.push([DAY_START + bucket * span, mode === "avg" ? sum / count : latest]);
  };
  for (const [t, v] of points) {
    const b = Math.floor((t - DAY_START) / span);
    if (b !== bucket) {
      flush();
      bucket = b;
      sum = 0;
      count = 0;
    }
    sum += v;
    count += 1;
    latest = v;
  }
  flush();
  return out;
}
