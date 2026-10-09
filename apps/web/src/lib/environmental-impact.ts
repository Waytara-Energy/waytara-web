import { EMISSION_FACTOR } from "./emission-factor";

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
