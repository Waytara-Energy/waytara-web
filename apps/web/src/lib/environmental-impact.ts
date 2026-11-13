import { EMISSION_FACTOR, PETROL_CAR } from "./emission-factor";

/**
 * CO2-avoided / trees-equivalent conversion for solar generation — the
 * "environmental impact" card every established solar monitoring app
 * (SolarEdge, Enphase, SMA Sunny Portal, Fronius Solar.web) shows
 * alongside raw kWh figures. Both constants are estimates, not metered
 * values — presented as such everywhere they're used, same as the
 * tariff-rate cost estimates elsewhere in this app.
 */

// India's grid average CO2 emission factor (CEA baseline), kept with its source and year in emission-factor.ts.
const GRID_CO2_FACTOR_KG_PER_KWH = EMISSION_FACTOR.kgPerKwh;

// A mature tree absorbs roughly this much CO2 per year — the commonly
// cited EPA-derived figure most solar CO2 calculators converge on.
const CO2_KG_PER_TREE_PER_YEAR = 21;

export function co2AvoidedKg(energyKwh: number): number {
  return energyKwh * GRID_CO2_FACTOR_KG_PER_KWH;
}

export function treesEquivalent(co2Kg: number): number {
  return co2Kg / CO2_KG_PER_TREE_PER_YEAR;
}

/**
 * What driving an electric car instead of a petrol one has saved: the petrol car's emissions over the same distance, less what the electricity that
 * charged the car gave off (only the part drawn from the grid, at the grid's factor; solar and battery energy count as clean). `evKwh` is all the energy
 * charged, `gridKwh` the part of it from the grid, `kmPerKwh` how far the car goes on one kWh. Never below zero.
 */
export function evCo2SavedKg(evKwh: number, gridKwh: number, kmPerKwh: number): { kg: number; km: number } {
  const km = Math.max(0, evKwh) * kmPerKwh;
  return { kg: Math.max(0, km * PETROL_CAR.kgPerKm - Math.max(0, gridKwh) * EMISSION_FACTOR.kgPerKwh), km };
}
