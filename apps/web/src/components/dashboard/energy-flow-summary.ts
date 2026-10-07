// Numbers and wording for the energy-flow diagram, kept apart from the component so they can be tested.

/** Power in kW with two decimals, the same format as the cards below the diagram (e.g. "6.50 kW"). */
export function fmtKw(watts: number | null): string {
  if (watts === null) return "—";
  return `${(Math.abs(watts) / 1000).toFixed(2)} kW`;
}

/** A line's thickness in drawing units: thin when little power flows, up to 4.5 around 10 kW and beyond. */
export function lineWidth(watts: number): number {
  return 1.5 + 3 * Math.min(1, Math.max(0, watts) / 10_000);
}

export type FlowMode = "Exporting" | "Importing" | "Solar" | "Battery" | "Idle" | "Offline";

export interface Summary {
  mode: FlowMode;
  text: string;
}

/** What the site is doing overall, in a word (for the centre of the diagram) and a sentence (below it).
 *  `batteryW` is positive while charging, negative while discharging; `gridW` positive = importing. */
export function summarize(solarW: number | null, batteryW: number | null, gridW: number | null, loadW: number | null, offline = false): Summary {
  if (offline) return { mode: "Offline", text: "Device offline - no live readings" };
  const solar = Math.max(0, solarW ?? 0);
  const load = Math.max(0, loadW ?? 0);
  const discharging = batteryW !== null && batteryW < 0 ? -batteryW : 0;

  let mode: FlowMode = "Idle";
  let lead = "System idle";
  if (gridW !== null && gridW < 0) {
    mode = "Exporting";
    lead = `Exporting ${fmtKw(gridW)} to the grid`;
  } else if (gridW !== null && gridW > 0) {
    mode = "Importing";
    lead = `Importing ${fmtKw(gridW)} from the grid`;
  } else if (discharging > solar && load > 0) {
    mode = "Battery";
    lead = "Running on battery";
  } else if (solar > 0) {
    mode = "Solar";
    lead = "Running on solar";
  }

  const parts = [lead];
  if (load > 0 && solarW !== null) parts.push(`Solar covers ${Math.min(100, Math.round((solar / load) * 100))}% of load`);
  return { mode, text: parts.join(" · ") };
}
