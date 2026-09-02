import { BatteryCharging, Home, Sun, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Colors are deliberately not the app's categorical palette — they encode
 *  *direction*, not identity: green = flowing toward self-sufficiency
 *  (exporting surplus, battery charging), amber = drawing from the grid or
 *  the battery (still normal operation, just informational), slate = idle.
 *  Kept as literal hex rather than Tailwind classes so the same value can
 *  drive both the node ring and the SVG stroke/marker fill from one place. */
const FLOW_COLOR = {
  favorable: "#10b981", // emerald-500
  drawing: "#f59e0b", // amber-500
  idle: "#94a3b8", // slate-400
  neutral: "#3b82f6", // blue-500 — load, which only ever consumes
} as const;

type FlowColorKey = keyof typeof FLOW_COLOR;

interface Point {
  x: number;
  y: number;
}

interface FlowLine {
  key: string;
  from: Point;
  to: Point;
  color: string;
}

function fmtW(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(Math.abs(value)).toLocaleString("en-IN")} W`;
}

export function EnergyFlowDiagram({
  solarW,
  batteryW,
  gridW,
  loadW,
  batterySocPct,
}: {
  solarW: number | null;
  /** positive = charging, negative = discharging */
  batteryW: number | null;
  /** positive = importing, negative = exporting */
  gridW: number | null;
  loadW: number | null;
  batterySocPct: number | null;
}) {
  const solarActive = (solarW ?? 0) > 0;
  const batteryCharging = (batteryW ?? 0) > 0;
  const batteryDischarging = (batteryW ?? 0) < 0;
  const gridImporting = (gridW ?? 0) > 0;
  const gridExporting = (gridW ?? 0) < 0;
  const loadActive = (loadW ?? 0) > 0;

  const solarColor: FlowColorKey = solarActive ? "favorable" : "idle";
  const batteryColor: FlowColorKey = batteryCharging ? "favorable" : batteryDischarging ? "drawing" : "idle";
  const gridColor: FlowColorKey = gridExporting ? "favorable" : gridImporting ? "drawing" : "idle";
  const loadColor: FlowColorKey = loadActive ? "neutral" : "idle";

  // Node centers, percentage coordinates in a 100x100 box; lines stop
  // short of each node's edge so the arrowhead doesn't sit under the card.
  const inverter: Point = { x: 50, y: 50 };
  const solar: Point = { x: 50, y: 10 };
  const battery: Point = { x: 12, y: 50 };
  const grid: Point = { x: 88, y: 50 };
  const load: Point = { x: 50, y: 90 };

  // Direction flips which end the arrowhead is on: flow always points
  // toward wherever the energy is actually going right now.
  const lines: FlowLine[] = [
    solarActive
      ? { key: "solar", from: { x: 50, y: 22 }, to: { x: 50, y: 38 }, color: FLOW_COLOR[solarColor] }
      : { key: "solar", from: { x: 50, y: 38 }, to: { x: 50, y: 22 }, color: FLOW_COLOR[solarColor] },
    batteryCharging
      ? { key: "battery", from: { x: 38, y: 50 }, to: { x: 24, y: 50 }, color: FLOW_COLOR[batteryColor] }
      : { key: "battery", from: { x: 24, y: 50 }, to: { x: 38, y: 50 }, color: FLOW_COLOR[batteryColor] },
    gridExporting
      ? { key: "grid", from: { x: 62, y: 50 }, to: { x: 76, y: 50 }, color: FLOW_COLOR[gridColor] }
      : { key: "grid", from: { x: 76, y: 50 }, to: { x: 62, y: 50 }, color: FLOW_COLOR[gridColor] },
    { key: "load", from: { x: 50, y: 62 }, to: { x: 50, y: 78 }, color: FLOW_COLOR[loadColor] },
  ];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          {lines.map((line) => (
            <marker
              key={line.key}
              id={`flow-arrow-${line.key}`}
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill={line.color} />
            </marker>
          ))}
        </defs>
        {lines.map((line) => (
          <line
            key={line.key}
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke={line.color}
            strokeWidth="1.5"
            strokeLinecap="round"
            markerEnd={`url(#flow-arrow-${line.key})`}
          />
        ))}
      </svg>

      <FlowNode point={solar} icon={<Sun className="size-5" />} label="Solar" value={fmtW(solarW)} color={FLOW_COLOR[solarColor]} />
      <FlowNode
        point={battery}
        icon={<BatteryCharging className="size-5" />}
        label="Battery"
        value={batterySocPct !== null ? `${Math.round(batterySocPct)}%` : "—"}
        sublabel={fmtW(batteryW)}
        color={FLOW_COLOR[batteryColor]}
      />
      <FlowNode point={inverter} icon={<Zap className="size-5" />} label="Inverter" value="" color="#64748b" center />
      <FlowNode
        point={grid}
        icon={<GridIcon />}
        label="Grid"
        value={fmtW(gridW)}
        sublabel={gridImporting ? "Importing" : gridExporting ? "Exporting" : "Idle"}
        color={FLOW_COLOR[gridColor]}
      />
      <FlowNode point={load} icon={<Home className="size-5" />} label="Load" value={fmtW(loadW)} color={FLOW_COLOR[loadColor]} />
    </div>
  );
}

function GridIcon() {
  // lucide's closest "transmission tower" equivalent isn't in this app's
  // icon set yet — a simple bespoke glyph, sized to match the others.
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v20M6 8l6-4 6 4M4 14l8-4 8 4M2 20l10-5 10 5" />
    </svg>
  );
}

function FlowNode({
  point,
  icon,
  label,
  value,
  sublabel,
  color,
  center = false,
}: {
  point: Point;
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
  center?: boolean;
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-2 bg-background shadow-sm",
          center ? "size-14" : "size-12"
        )}
        style={{ borderColor: color, color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {value && <p className="text-xs font-semibold text-foreground">{value}</p>}
        {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}
