import { BatteryCharging, Sun, Zap } from "lucide-react";

/** The source of a charge's energy: the source bar's own colours (not the energy flow's): the sun's warm yellow, a calm teal for the battery, indigo for the grid. */
export const SOURCE = {
  solar: { icon: Sun, color: "#fbbf24" },
  battery: { icon: BatteryCharging, color: "#14b8a6" },
  grid: { icon: Zap, color: "#6366f1" },
  unattributed: { icon: Zap, color: "var(--border)" },
} as const;
