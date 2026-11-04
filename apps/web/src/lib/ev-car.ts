/** The person's car, for what a charge means to them: how much of the battery it adds and how far that drives. Kept in the person's own
 *  preferences (profiles.ui_preferences.ev_car). The charger only reports the energy it delivers, never the car's own charge level, so
 *  nothing here claims to know where the battery stands: only what this charge has added. */

export interface CarProfile {
  /** the battery's usable size, kWh */
  batteryKwh: number;
  /** how far the car goes on one kWh of charge, km */
  kmPerKwh: number;
}

/** A typical small electric car: what the form suggests until the person types their own. */
export const DEFAULT_KM_PER_KWH = 6;
const BATTERY_RANGE = [5, 250] as const;
const EFFICIENCY_RANGE = [1, 15] as const;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const within = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;

/** The car saved in a profile's ui_preferences, or null when none was saved (or what is saved is not usable). */
export function parseCarProfile(prefs: unknown): CarProfile | null {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return null;
  const raw = (prefs as Record<string, unknown>).ev_car;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const battery = num(r.battery_kwh);
  const eff = num(r.km_per_kwh);
  if (battery === null || eff === null || !within(battery, BATTERY_RANGE) || !within(eff, EFFICIENCY_RANGE)) return null;
  return { batteryKwh: battery, kmPerKwh: eff };
}

/** What is written into ui_preferences for a car. */
export const carToJson = (c: CarProfile) => ({ ev_car: { battery_kwh: round(c.batteryKwh, 1), km_per_kwh: round(c.kmPerKwh, 2) } });

/** The two numbers typed in the form, checked: the problem in words, or the car. */
export function parseCarInput(batteryText: string, efficiencyText: string): { ok: true; car: CarProfile } | { ok: false; message: string } {
  const battery = Number(batteryText.trim().replace(",", "."));
  const eff = Number(efficiencyText.trim().replace(",", "."));
  if (batteryText.trim() === "" || !Number.isFinite(battery) || !within(battery, BATTERY_RANGE)) return { ok: false, message: `Type the battery size in kWh, between ${BATTERY_RANGE[0]} and ${BATTERY_RANGE[1]}.` };
  if (efficiencyText.trim() === "" || !Number.isFinite(eff) || !within(eff, EFFICIENCY_RANGE)) return { ok: false, message: `Type how many km the car goes on 1 kWh, between ${EFFICIENCY_RANGE[0]} and ${EFFICIENCY_RANGE[1]}.` };
  return { ok: true, car: { batteryKwh: battery, kmPerKwh: eff } };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export interface ChargeProgress {
  /** how far along the charge is, 0-100: of the amount booked when there is one, else of the car's battery size; null when neither is known */
  percent: number | null;
  percentOf: "booked" | "battery" | null;
  /** kWh still to deliver to reach the booked amount (null when none was booked) */
  remainingKwh: number | null;
  /** minutes until the booked amount is reached at the power now (null when none was booked or the power is too low to say) */
  minutesLeft: number | null;
  /** how far the energy delivered so far drives the car, km (null without a car) */
  kmAdded: number | null;
}

/** Below this the charger is idling, not delivering: no time can honestly be given. */
const MIN_POWER_KW = 0.5;

/** What a charge that has delivered `deliveredKwh` so far means: its percentage, the time left to the booked amount and the distance it adds. */
export function chargeProgress(a: { deliveredKwh: number | null; targetKwh: number | null; powerKw: number | null; car: CarProfile | null }): ChargeProgress {
  const delivered = a.deliveredKwh !== null && a.deliveredKwh >= 0 ? a.deliveredKwh : null;
  const target = a.targetKwh !== null && a.targetKwh > 0 ? a.targetKwh : null;
  let percent: number | null = null;
  let percentOf: ChargeProgress["percentOf"] = null;
  if (delivered !== null && target !== null) {
    percent = Math.min(100, (delivered / target) * 100);
    percentOf = "booked";
  } else if (delivered !== null && a.car) {
    percent = Math.min(100, (delivered / a.car.batteryKwh) * 100);
    percentOf = "battery";
  }
  const remaining = delivered !== null && target !== null ? Math.max(0, target - delivered) : null;
  const minutesLeft = remaining !== null && remaining > 0 && a.powerKw !== null && a.powerKw >= MIN_POWER_KW ? Math.max(1, Math.round((remaining / a.powerKw) * 60)) : null;
  return { percent, percentOf, remainingKwh: remaining, minutesLeft, kmAdded: delivered !== null && a.car ? delivered * a.car.kmPerKwh : null };
}

/** 7 -> "7 min", 65 -> "1 h 05 min". */
export function minutesText(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** 5.4 -> "5 km", 0.4 -> "< 1 km". */
export function kmText(km: number): string {
  if (km < 1) return "< 1 km";
  return `${Math.round(km).toLocaleString("en-IN")} km`;
}
