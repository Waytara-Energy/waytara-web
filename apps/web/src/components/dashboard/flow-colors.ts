import { HOT_WARN, HOT_WATCH } from "@/lib/performance-metrics";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";

/** What the colours of the energy charts mean, the same as on the Overview energy flow: green is producing or charging, amber is
 *  importing or discharging, blue is consuming or exporting, grey is idle. Every chart that shows one of those flows uses them. */
export const FLOW = {
  producing: "#10b981",
  drawing: "#f59e0b",
  consuming: "#3b82f6",
  idle: "#94a3b8",
} as const;

/** The solar inputs (PV1, PV2, ...): all producing, so shades of the producing green, told apart by their lightness. */
export const PV_SHADES = ["#10b981", "#6ee7b7", "#047857", "#a7f3d0"];


/** Temperature charts are coloured by how hot the reading is, not by the flow colours: green is fine, amber is warm (worth watching),
 *  red is high. */
export const HEAT = { good: "#10b981", warm: "#f59e0b", high: "#ef4444" } as const;

export interface HeatLimits {
  /** From here the reading is warm. */
  warm: number;
  /** From here the reading is high. */
  high: number;
}

/** The warm and high marks of a temperature key: 80% and 90% of its ceiling. */
export function heatLimits(key: string): HeatLimits | undefined {
  const max = TEMPERATURE_MAX_C[key];
  return max === undefined ? undefined : { warm: max * HOT_WATCH, high: max * HOT_WARN };
}

export const heatColor = (value: number, limits: HeatLimits) => (value >= limits.high ? HEAT.high : value >= limits.warm ? HEAT.warm : HEAT.good);
