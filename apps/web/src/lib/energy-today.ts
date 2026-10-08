// Numbers and shaping for Overview's "today" cards (solar generated, load, battery, grid): the day's energy totals from
// the inverter's own counters, a comparison with yesterday at the same time of day, and the chart points.

/** The inverter's own "today" energy counters (kWh, reset at midnight). */
export const TODAY_COUNTER_KEYS = {
  solar: "day_pv_energy_kwh",
  load: "day_load_energy_kwh",
  charged: "day_battery_charge_energy_kwh",
  discharged: "day_battery_discharge_energy_kwh",
  imported: "day_grid_import_energy_kwh",
  exported: "day_grid_export_energy_kwh",
} as const;

export const SLOT_MS = 900_000; // the 15-minute buckets the charts are drawn from

export function fmtKwh(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(v >= 100 ? 0 : 1)} kWh`;
}

/** Change of today so far against yesterday at this time of day, in percent. Null when yesterday has too little to
 *  compare with (a brand-new system, or a counter that has not moved yet). */
export function deltaPct(today: number | null, yesterday: number | null): number | null {
  if (today === null || yesterday === null || yesterday < 0.05) return null;
  return ((today - yesterday) / yesterday) * 100;
}

export function fmtDelta(pct: number): string {
  const rounded = Math.round(Math.abs(pct));
  return `${pct >= 0 ? "↑" : "↓"} ${rounded}%`;
}

/** Index of the slot that contains `ms`, or null outside the axis. `axis` holds each slot's start. */
export function slotIndex(axis: number[], ms: number): number | null {
  if (axis.length === 0 || ms < axis[0]) return null;
  const i = Math.floor((ms - axis[0]) / SLOT_MS);
  return i < axis.length ? i : null;
}

export interface AreaPoint {
  t: number;
  /** The (scaled) value; below zero for the negative side of a signed series. Null = no reading. */
  v: number | null;
}

/** Chart points up to `nowMs` (the future of the day stays empty), scaled (e.g. W -> kW). */
export function areaPoints(axis: number[], values: (number | null)[], nowMs: number, scale: number): AreaPoint[] {
  const out: AreaPoint[] = [];
  axis.forEach((t, i) => {
    if (t > nowMs) return;
    const raw = values[i];
    out.push({ t, v: raw === null || raw === undefined || !Number.isFinite(raw) ? null : raw * scale });
  });
  return out;
}

/** How far back the Overview cards' graphs reach. */
export const RECENT_WINDOW_MS = 2 * 3_600_000;

/** The recent readings: every 15-minute slot that overlaps the `windowMs` before `nowMs` (two hours), the slot being filled now included. */
export function recentPoints(points: AreaPoint[], nowMs: number, windowMs = RECENT_WINDOW_MS): AreaPoint[] {
  return points.filter((p) => p.t <= nowMs && p.t + SLOT_MS > nowMs - windowMs);
}

/** The x range of the recent-readings graph (from `windowMs` before `nowMs`, or the start of its first slot, to now) and five marks along it. */
export function recentAxis(points: AreaPoint[], nowMs: number, windowMs = RECENT_WINDOW_MS): { start: number; end: number; ticks: number[] } {
  const start = Math.min(points[0]?.t ?? nowMs - windowMs, nowMs - windowMs);
  const end = nowMs;
  return { start, end, ticks: Array.from({ length: 5 }, (_, i) => start + ((end - start) * i) / 4) };
}

/** The biggest reading of the day so far (zero or below does not count as a peak). */
export function peakOf(points: AreaPoint[]): { v: number; t: number } | null {
  let best: { v: number; t: number } | null = null;
  for (const p of points) if (p.v !== null && p.v > 0 && (best === null || p.v > best.v)) best = { v: p.v, t: p.t };
  return best;
}

/** Hour marks for the x axis from midnight to `end`: every 2 hours for a short span, every 3 for a longer one. */
export function axisTicks(dayStart: number, end: number): number[] {
  const hour = 3_600_000;
  const span = (end - dayStart) / hour;
  const step = span <= 10 ? 2 : 3;
  const out: number[] = [];
  for (let h = 0; h <= span + 1e-9; h += step) out.push(dayStart + h * hour);
  return out;
}
