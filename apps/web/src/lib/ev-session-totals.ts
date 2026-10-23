import { sessionEnergyKwh, type EvSessionRow } from "./ev-sessions";

/** What the totals row of the Charging sessions page says about the sessions of a period. Pure, so it is tested without a database. */

export interface EvTotals {
  count: number;
  /** energy of the sessions whose energy is known */
  energyKwh: number;
  /** the share of the attributed energy that came from solar (0 to 100); null when no session has a split */
  solarPct: number | null;
  /** what the grid supplied of it (kWh), when any session has a split */
  gridKwh: number | null;
  longestSeconds: number | null;
}

export function evTotals(rows: readonly EvSessionRow[]): EvTotals {
  let energy = 0;
  let solar = 0;
  let grid = 0;
  let attributed = 0;
  let any = false;
  let longest: number | null = null;
  for (const s of rows) {
    energy += sessionEnergyKwh(s) ?? 0;
    const parts = [s.energy_from_solar_kwh, s.energy_from_battery_kwh, s.energy_from_grid_kwh];
    if (parts.some((v) => v !== null)) {
      any = true;
      solar += s.energy_from_solar_kwh ?? 0;
      grid += s.energy_from_grid_kwh ?? 0;
      attributed += parts.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    }
    if (s.status !== "active" && s.charging_seconds !== null && (longest === null || s.charging_seconds > longest)) longest = s.charging_seconds;
  }
  return { count: rows.length, energyKwh: energy, solarPct: any && attributed > 0 ? (solar / attributed) * 100 : null, gridKwh: any ? grid : null, longestSeconds: longest };
}

/** An estimate of what the charging cost: the grid's part at the site's tariff (the solar and battery parts are not billed), or all of it when no split is known. */
export function evCostEstimate(t: EvTotals, tariffPerKwh: number): number {
  return (t.gridKwh ?? t.energyKwh) * tariffPerKwh;
}
