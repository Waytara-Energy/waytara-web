/** The grid emission factor every CO2-avoided figure uses, with where it comes from, so a report can print it. India's national
 *  grid average (weighted, all stations) from the CEA CO2 Baseline Database: 0.727 tCO2/MWh for 2023-24 and about 0.710 for 2024-25
 *  (version 21.0, marked provisional there). Update it once a year when CEA publishes the new database; the figure used is printed
 *  on every report. */
export const EMISSION_FACTOR = {
  kgPerKwh: 0.71,
  year: "2024-25",
  source: "CEA CO2 Baseline Database v21.0, weighted average",
  provisional: true,
} as const;

/** "0.71 kg CO2/kWh - CEA CO2 Baseline Database v21.0, weighted average, 2024-25, provisional" */
export function emissionFactorNote(): string {
  const f = EMISSION_FACTOR;
  return `${f.kgPerKwh} kg CO2/kWh - ${f.source}, ${f.year}${f.provisional ? ", provisional" : ""}`;
}
