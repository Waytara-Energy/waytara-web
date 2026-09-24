/**
 * Derives display-only facts from a `setting_presets` row's own `values`
 * (tou_slot{1-6}_start_time / _flags) rather than hardcoding anything
 * preset-specific in the UI — so a new preset added later (say, a fourth
 * template) automatically gets the same "here's when it draws from the
 * grid" treatment with no code change.
 *
 * bit0 of tou_slot{N}_flags is the only confirmed "charges from grid" bit
 * (see device_parameter_map's tou_slot1_flags notes) — bit1 is generator
 * and bit2 is an unverified always-on bit, neither relevant here.
 */

import type { HourWindow } from "./energy-aggregation";

const CHARGE_FROM_GRID_BIT = 0b001;

export function gridChargeWindows(values: Record<string, unknown>): HourWindow[] {
  const slots = Array.from({ length: 6 }, (_, i) => i + 1).map((n) => ({
    startHour: Math.floor(Number(values[`tou_slot${n}_start_time`] ?? 0) / 100),
    chargesFromGrid: (Number(values[`tou_slot${n}_flags`] ?? 0) & CHARGE_FROM_GRID_BIT) !== 0,
  }));

  const windows: HourWindow[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].chargesFromGrid) continue;
    const next = slots[i + 1];
    windows.push({ startHour: slots[i].startHour, endHour: next ? next.startHour : 24 });
  }
  return windows;
}

export function formatHourWindows(windows: HourWindow[]): string {
  return windows.map((w) => `${String(w.startHour).padStart(2, "0")}:00–${String(w.endHour % 24).padStart(2, "0")}:00`).join(", ");
}
