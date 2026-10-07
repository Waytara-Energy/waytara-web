// What each piece of equipment in the energy flow is doing right now: a short state word, a colour tone and a
// one-sentence description for the tooltip. Pure logic, so it can be tested.

import type { NodeKind } from "./energy-flow-layout";

export type BadgeTone = "producing" | "drawing" | "consuming" | "idle";

export interface StateBadge {
  label: string;
  /** One sentence for the tooltip. */
  description: string;
  tone: BadgeTone;
}

/** Where the home's power is coming from right now. */
export type HomeSource = "solar" | "grid" | "battery" | "idle";

const IDLE: StateBadge = { label: "Idle", description: "Not exchanging any power right now.", tone: "idle" };

/** Which source is covering the load: grid import wins outright (it costs money), otherwise whichever of solar
 *  or battery contributes more. `batteryW` is positive while charging, negative while discharging. */
export function homeSourceOf(loadW: number | null, solarW: number | null, batteryW: number | null, gridW: number | null): HomeSource {
  if (loadW === null || loadW <= 0) return "idle";
  if (gridW !== null && gridW > 0) return "grid";
  const solar = Math.max(0, solarW ?? 0);
  const battery = batteryW !== null && batteryW < 0 ? -batteryW : 0;
  if (battery > solar) return "battery";
  return solar > 0 ? "solar" : "idle";
}

export function badgeFor(kind: NodeKind, watts: number | null, homeSource: HomeSource = "idle"): StateBadge {
  const w = watts ?? 0;
  switch (kind) {
    case "solar":
      return w > 0 ? { label: "Producing", description: "Generating power and feeding the inverter.", tone: "producing" } : IDLE;
    case "grid":
      if (w > 0) return { label: "Importing", description: "Drawing power from the grid.", tone: "drawing" };
      if (w < 0) return { label: "Exporting", description: "Sending surplus power to the grid.", tone: "consuming" };
      return IDLE;
    case "battery":
    case "ups":
      if (w > 0) return { label: "Charging", description: "Taking power from the inverter to charge.", tone: "producing" };
      if (w < 0) return { label: "Discharging", description: "Supplying stored power to the inverter.", tone: "drawing" };
      return IDLE;
    case "generator":
      return w > 0 ? { label: "Running", description: "Running and feeding the inverter.", tone: "drawing" } : IDLE;
    case "home":
      if (homeSource === "solar") return { label: "Solar-powered", description: "The load is being supplied mainly by solar.", tone: "producing" };
      if (homeSource === "grid") return { label: "Grid power", description: "The load is being supplied by the grid.", tone: "drawing" };
      if (homeSource === "battery") return { label: "Battery-powered", description: "The load is being supplied mainly by the battery.", tone: "drawing" };
      return IDLE;
    case "ev":
      return w > 0 ? { label: "Charging", description: "Delivering power to the connected vehicle.", tone: "consuming" } : IDLE;
  }
}
