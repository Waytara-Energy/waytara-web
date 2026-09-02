/**
 * The System Work Mode tab's Time-of-Use schedule: Deye's Prog1-6 slots.
 * Kept out of the generic `SettingField` catalog because it isn't one
 * value per key — it's a 6-row table, edited and saved as a set, with its
 * own validation that spans rows (chronological order, no overlap).
 *
 * Each slot's *end* is implicit — it's the next slot's start time, wrapping
 * from Prog6 back to Prog1 at midnight — so "no overlap" reduces to "start
 * times strictly increase from Prog1 to Prog6". The manual confirms the
 * firmware won't reject a bad ordering itself, so this app enforces it
 * before ever writing to `device_settings`.
 */

export const TOU_PROGRAM_COUNT = 6;

export type ChargeSource = "solar_only" | "solar_and_grid" | "solar_and_gen" | "solar_grid_gen";

export interface TouSlot {
  /** 1-6, Prog1..Prog6. */
  index: number;
  /** "HH:MM", 24h. */
  startTime: string;
  powerW: number;
  capacityPct: number;
  chargeSource: ChargeSource;
  gridSellEnabled: boolean;
}

export function defaultTouSlots(): TouSlot[] {
  // Evenly spaced 4-hour slots starting at midnight — a harmless, clearly
  // "not yet configured" default that already satisfies the ordering rule,
  // so a customer opening this tab for the first time doesn't hit a
  // validation error before they've touched anything.
  return Array.from({ length: TOU_PROGRAM_COUNT }, (_, i) => ({
    index: i + 1,
    startTime: `${String((i * 4) % 24).padStart(2, "0")}:00`,
    powerW: 0,
    capacityPct: 0,
    chargeSource: "solar_only" as ChargeSource,
    gridSellEnabled: false,
  }));
}

function toMinutes(hhmm: string): number | null {
  const m = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Returns an error message, or null if the schedule is valid. */
export function validateTouSlots(slots: TouSlot[]): string | null {
  if (slots.length !== TOU_PROGRAM_COUNT) {
    return `Expected ${TOU_PROGRAM_COUNT} programs.`;
  }

  const minutes: number[] = [];
  for (const slot of slots) {
    const m = toMinutes(slot.startTime);
    if (m === null) {
      return `Prog${slot.index}: start time must be in HH:MM (24h) format.`;
    }
    minutes.push(m);

    if (!Number.isFinite(slot.powerW) || slot.powerW < 0 || slot.powerW > 8000) {
      return `Prog${slot.index}: power must be between 0 and 8000W.`;
    }
    if (!Number.isFinite(slot.capacityPct) || slot.capacityPct < 0 || slot.capacityPct > 100) {
      return `Prog${slot.index}: capacity must be between 0 and 100%.`;
    }
  }

  for (let i = 1; i < minutes.length; i++) {
    if (minutes[i] <= minutes[i - 1]) {
      return `Prog${i + 1}'s start time must be later than Prog${i}'s — programs must run in chronological order with no overlap.`;
    }
  }

  return null;
}
