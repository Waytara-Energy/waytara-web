// What the Performance page works out from the inverter's own lifetime and daily counters. Pure functions (no
// database, no React), so the rules are in one place and tested.

/** The inverter's lifetime counters (kWh, since it was commissioned). */
export const LIFETIME_KEYS = {
  pv: "total_pv_energy_kwh",
  acOut: "total_active_energy_kwh",
  charged: "total_battery_charge_energy_kwh",
  discharged: "total_battery_discharge_energy_kwh",
  load: "total_load_energy_kwh",
  imported: "total_grid_import_energy_kwh",
  exported: "total_grid_export_energy_kwh",
} as const;

/** The same, for today (reset at midnight). */
export const DAY_KEYS = {
  pv: "day_pv_energy_kwh",
  acOut: "day_active_energy_kwh",
  charged: "day_battery_charge_energy_kwh",
  discharged: "day_battery_discharge_energy_kwh",
  load: "day_load_energy_kwh",
  imported: "day_grid_import_energy_kwh",
  exported: "day_grid_export_energy_kwh",
} as const;

/** Every figure the cards and sections read live, besides the PV inputs' own (those depend on the device). */
export const PERFORMANCE_LIVE_KEYS = [
  ...Object.values(LIFETIME_KEYS),
  ...Object.values(DAY_KEYS),
  "battery_soc_pct",
  "battery_voltage_v",
  "battery_current_a",
  "battery_temperature_c",
  "bms_charge_current_limit_a",
  "bms_discharge_current_limit_a",
  "bms_charge_voltage_v",
  "bms_temperature_c",
  "inverter_ac_temperature_c",
  "inverter_dc_temperature_c",
  "inverter_output_power_w",
  "grid_frequency_hz",
  "grid_total_power_w",
  "grid_ct_total_power_w",
  "grid_ct_l1_power_w",
  "grid_ct_l1_current_a",
];

/** The keys of one PV input: power, voltage, current. */
export function pvInputKeys(pvKeys: string[]): string[] {
  return pvKeys.flatMap((k) => {
    const n = /^pv(\d+)_/.exec(k)?.[1];
    return n ? [k, `pv${n}_voltage_v`, `pv${n}_current_a`] : [k];
  });
}

export type Num = number | null | undefined;
const isNum = (v: Num): v is number => typeof v === "number" && Number.isFinite(v);

/** part / whole as a percentage clamped to 0-100; null when there is nothing to divide by. */
export function pct(part: Num, whole: Num): number | null {
  if (!isNum(part) || !isNum(whole) || whole <= 0) return null;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

/** Share of the solar energy that was used on site (not sent to the grid). */
export function selfConsumptionPct(pv: Num, exported: Num): number | null {
  if (!isNum(pv) || !isNum(exported) || pv <= 0) return null;
  return pct(pv - exported, pv);
}

/** Share of the home's energy that did not come from the grid. */
export function selfSufficiencyPct(load: Num, imported: Num): number | null {
  if (!isNum(load) || !isNum(imported) || load <= 0) return null;
  return pct(load - imported, load);
}

/** Energy out of the battery as a share of the energy put in. Only meaningful once the battery has cycled a few times:
 *  early on most of what went in is still stored, so below `minChargedKwh` this says nothing yet (null). */
export function roundTripPct(charged: Num, discharged: Num, minChargedKwh = 5): number | null {
  if (!isNum(charged) || !isNum(discharged) || charged < minChargedKwh) return null;
  return Math.min(100, (discharged / charged) * 100);
}

export interface Split {
  label: string;
  kwh: number;
}

/** Where the solar energy went: sent to the grid, stored in the battery, used by the home (an estimate: the battery is
 *  assumed to be charged from the sun and what is left over is what the home used directly). */
export function solarSplit(pv: Num, exported: Num, charged: Num): Split[] | null {
  if (!isNum(pv) || pv <= 0) return null;
  const exp = Math.min(Math.max(exported ?? 0, 0), pv);
  const stored = Math.min(Math.max(charged ?? 0, 0), pv - exp);
  return [
    { label: "Sent to the grid", kwh: exp },
    { label: "Stored in the battery", kwh: stored },
    { label: "Used at home", kwh: Math.max(0, pv - exp - stored) },
  ];
}

/** Where the home's energy came from: the grid, the battery, the sun (an estimate: what is left after the grid and the
 *  battery is taken as solar). */
export function homeSupply(load: Num, imported: Num, discharged: Num): Split[] | null {
  if (!isNum(load) || load <= 0) return null;
  const grid = Math.min(Math.max(imported ?? 0, 0), load);
  const battery = Math.min(Math.max(discharged ?? 0, 0), load - grid);
  return [
    { label: "Solar", kwh: Math.max(0, load - grid - battery) },
    { label: "Battery", kwh: battery },
    { label: "Grid", kwh: grid },
  ];
}

/** The two PV inputs compared: which one is weaker and by how much (as a share of the stronger one). */
export function pvImbalance(a: Num, b: Num, minKwh = 1): { weaker: 1 | 2 | null; gapPct: number } | null {
  if (!isNum(a) || !isNum(b) || a < minKwh || b < minKwh) return null;
  const strong = Math.max(a, b);
  const gapPct = ((strong - Math.min(a, b)) / strong) * 100;
  return { weaker: a === b ? null : a < b ? 1 : 2, gapPct };
}

// ------------------------------------------------------------------ solar health

export interface DayRow {
  day: string;
  /** Energy of the day, kWh (null = no reading that day). */
  kwh: number | null;
  /** Energy of each PV input that day (kWh), in input order. */
  inputs: (number | null)[];
}

export interface Insight {
  id: string;
  tone: "good" | "info" | "warn";
  title: string;
  body: string;
}

export const LEARNING_DAYS = 7;
export const SOILING_MIN_DAYS = 10;
/** The best of the last 3 days this far below the best of the 14 days before counts as "probably dirty". */
export const SOILING_WARN = 0.08;
export const SOILING_WATCH = 0.03;
export const IMBALANCE_WARN_PCT = 15;
/** Temperature as a share of the sensor's own limit. */
export const HOT_WARN = 0.9;
export const HOT_WATCH = 0.8;

const sum = (xs: (number | null)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);

/** Plain-language findings about the solar array from its recent days (oldest first, today not included). */
export function solarInsights(input: { days: DayRow[]; tariffPerKwh: number; hottestRatio: number | null }): Insight[] {
  const out: Insight[] = [];
  const days = input.days.filter((d) => d.kwh !== null);
  const kwhs = days.map((d) => d.kwh as number);

  if (days.length < LEARNING_DAYS) {
    out.push({
      id: "learning",
      tone: "info",
      title: `Learning your system - ${days.length} of ${LEARNING_DAYS} days`,
      body: "Checks for dust and shading need about a week of history. They switch on by themselves as the days add up.",
    });
  }

  // Dust (without a weather feed): the best of the last 3 days against the best of the 14 before. A cloudy day lowers an
  // ordinary day but not the best one, so a lasting drop of the best days points at the panels, not the sky.
  if (kwhs.length >= SOILING_MIN_DAYS) {
    const recent = Math.max(...kwhs.slice(-3));
    const earlier = Math.max(...kwhs.slice(-17, -3));
    if (earlier > 1) {
      const drop = 1 - recent / earlier;
      const lostKwh = Math.max(0, earlier - recent);
      if (drop >= SOILING_WARN) {
        const rupees = lostKwh * input.tariffPerKwh;
        out.push({
          id: "soiling",
          tone: "warn",
          title: "Your panels may need cleaning",
          body: `Your best recent days make ${(drop * 100).toFixed(0)}% less than your best days a week or two ago (about ${lostKwh.toFixed(1)} kWh, ₹${rupees.toFixed(0)} a day). If it has been dry and sunny, dust on the panels is the likely cause - cleaning them usually brings it back. If it has been cloudy or rainy, wait a few clear days first.`,
        });
      } else if (drop >= SOILING_WATCH) {
        out.push({ id: "soiling", tone: "info", title: "Production is slightly lower", body: `Your best recent days are ${(drop * 100).toFixed(0)}% below your earlier best. That is within normal weather and season change - we will tell you if it keeps falling.` });
      } else {
        out.push({ id: "soiling", tone: "good", title: "Production is holding up", body: "Your best recent days match your earlier best, so there is no sign of dust or shading building up." });
      }
    }
  }

  // The two PV inputs over the last 3 days with both producing.
  const recentDays = days.slice(-3);
  const a = sum(recentDays.map((d) => d.inputs[0] ?? null));
  const b = sum(recentDays.map((d) => d.inputs[1] ?? null));
  const imbalance = pvImbalance(a, b);
  if (imbalance) {
    if (imbalance.gapPct >= IMBALANCE_WARN_PCT && imbalance.weaker) {
      out.push({
        id: "imbalance",
        tone: "warn",
        title: `PV${imbalance.weaker} is producing ${imbalance.gapPct.toFixed(0)}% less than PV${imbalance.weaker === 1 ? 2 : 1}`,
        body: "If both inputs have the same number of panels, one of them may be shaded, dirty or have a loose connection. Look at the panels on that input at midday.",
      });
    } else {
      out.push({ id: "imbalance", tone: "good", title: "PV1 and PV2 are balanced", body: `They differ by ${imbalance.gapPct.toFixed(0)}% over the last days, which is normal.` });
    }
  }

  if (input.hottestRatio !== null && input.hottestRatio >= HOT_WATCH) {
    out.push({
      id: "heat",
      tone: input.hottestRatio >= HOT_WARN ? "warn" : "info",
      title: input.hottestRatio >= HOT_WARN ? "The inverter is running very hot" : "The inverter is running warm",
      body: "Check that its fan and vents are clear and the room is ventilated. A very hot inverter cuts its power to protect itself, which lowers production.",
    });
  }
  return out;
}

/** Average of the readings taken between two hours of an IST day (e.g. 2 and 4 for the overnight standby draw). */
export function averageBetweenHours(axis: number[], values: (number | null)[], dayStartMs: number, fromHour: number, toHour: number): number | null {
  const from = dayStartMs + fromHour * 3_600_000;
  const to = dayStartMs + toHour * 3_600_000;
  let total = 0;
  let n = 0;
  axis.forEach((t, i) => {
    const v = values[i];
    if (t >= from && t < to && isNum(v)) {
      total += v;
      n += 1;
    }
  });
  return n > 0 ? total / n : null;
}
