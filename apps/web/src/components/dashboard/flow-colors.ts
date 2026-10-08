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

