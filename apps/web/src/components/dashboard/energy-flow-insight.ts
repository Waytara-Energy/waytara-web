// What the tooltip on each energy-flow circle says. The circle already shows its power and state, so the tooltip adds
// what those two numbers do not: what the equipment is doing for the rest of the site right now (how much of the load
// the solar covers, where the load's power comes from, how much solar is going to the grid, ...).

import { fmtKw } from "./energy-flow-summary";
import type { NodeKind } from "./energy-flow-layout";

export interface FlowReadings {
  solarW: number | null;
  /** Positive = charging, negative = discharging. */
  batteryW: number | null;
  /** Positive = importing, negative = exporting. */
  gridW: number | null;
  loadW: number | null;
  evW: number | null;
  /** The solar inputs one by one (PV1, PV2 ...). */
  pvInputs: { label: string; watts: number | null }[];
}

export interface Insight {
  headline: string;
  rows: { label: string; value: string }[];
}

const pct = (part: number, whole: number) => Math.round(Math.min(1, Math.max(0, part / whole)) * 100);

/** How the load is being supplied right now: solar first, then the battery, then the grid. */
export function loadSupply(r: Pick<FlowReadings, "solarW" | "batteryW" | "gridW" | "loadW">): { solar: number; battery: number; grid: number } | null {
  const load = r.loadW ?? 0;
  if (load <= 0) return null;
  const fromSolar = Math.min(load, Math.max(0, r.solarW ?? 0));
  const fromBattery = Math.min(load - fromSolar, Math.max(0, -(r.batteryW ?? 0)));
  const fromGrid = Math.max(0, load - fromSolar - fromBattery);
  return { solar: pct(fromSolar, load), battery: pct(fromBattery, load), grid: pct(fromGrid, load) };
}

export function insightFor(kind: NodeKind, r: FlowReadings): Insight {
  const solar = Math.max(0, r.solarW ?? 0);
  const load = Math.max(0, r.loadW ?? 0);
  const battery = r.batteryW ?? 0;
  const grid = r.gridW ?? 0;

  switch (kind) {
    case "solar": {
      if (solar <= 0) return { headline: "Not generating right now (night, or heavy cloud)", rows: [] };
      const rows = r.pvInputs.filter((p) => p.watts !== null).map((p) => ({ label: p.label, value: fmtKw(p.watts) }));
      if (load <= 0) return { headline: "Nothing is using it at the moment: it goes to the battery or the grid", rows };
      const covers = pct(solar, load);
      return { headline: covers >= 100 ? "Covers all of your load" : `Covers ${covers}% of your load`, rows };
    }
    case "home": {
      const supply = loadSupply(r);
      if (!supply) return { headline: "Nothing is using power right now", rows: [] };
      const rows = [
        { label: "Solar", value: `${supply.solar}%` },
        { label: "Battery", value: `${supply.battery}%` },
        { label: "Grid", value: `${supply.grid}%` },
      ].filter((x) => x.value !== "0%");
      return { headline: "Where your power is coming from", rows };
    }
    case "grid": {
      if (grid < 0) {
        const out = Math.abs(grid);
        return { headline: solar > 0 ? `${pct(out, solar)}% of your solar is being sold to the grid` : "Sending power to the grid", rows: [] };
      }
      if (grid > 0) return { headline: load > 0 ? `The grid is supplying ${pct(grid, load)}% of your load` : "Drawing power from the grid", rows: [] };
      return { headline: "Not exchanging power with the grid", rows: [] };
    }
    case "battery":
    case "ups": {
      if (battery > 0) return { headline: solar > load ? "Storing your surplus solar" : "Charging from the grid and solar", rows: [] };
      if (battery < 0) return { headline: load > 0 ? `Covering ${pct(-battery, load)}% of your load` : "Discharging", rows: [] };
      return { headline: "Holding its charge", rows: [] };
    }
    case "ev": {
      if ((r.evW ?? 0) <= 0) return { headline: "Not charging a vehicle", rows: [] };
      return { headline: solar >= (r.evW ?? 0) ? "Charging from your solar" : "Charging from solar and the grid", rows: [] };
    }
    case "generator":
      return { headline: "Backup power source", rows: [] };
  }
}
