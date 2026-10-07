import * as React from "react";
import { BatteryCharging, Fuel, Home, Plug, Server, ShieldCheck, Sun, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { curvePath, HUB_R, layoutFlow, NODE_R, type NodeKind } from "./energy-flow-layout";

/** Colors encode *direction*, not identity: green = flowing toward self-sufficiency (solar producing, battery
 *  charging, exporting surplus), amber = drawing on a source (grid import, battery discharging, generator), blue =
 *  consuming (home, EV charger), slate = idle. */
const COLOR = {
  producing: "#10b981", // emerald-500
  drawing: "#f59e0b", // amber-500
  consuming: "#3b82f6", // blue-500
  idle: "#94a3b8", // slate-400
} as const;
type Tone = keyof typeof COLOR;

// The same icons the Monitoring tabs use for these things.
const ICON: Record<NodeKind, LucideIcon> = {
  solar: Sun,
  grid: Zap,
  generator: Fuel,
  battery: BatteryCharging,
  ups: ShieldCheck,
  home: Home,
  ev: Plug,
};
const DEFAULT_LABEL: Record<NodeKind, string> = {
  solar: "Solar",
  grid: "Grid",
  generator: "Generator",
  battery: "Battery",
  ups: "UPS",
  home: "Home",
  ev: "EV Charger",
};

/** Something beyond the primary solar / battery / grid / home / EV set: more batteries or chargers, a generator, a UPS. */
export interface ExtraFlowNode {
  id: string;
  kind: "battery" | "ups" | "generator" | "ev";
  label: string;
  /** Battery / UPS: positive = charging. Generator / EV: positive = running / charging. */
  watts: number | null;
  socPct?: number | null;
}

interface FlowNode {
  id: string;
  kind: NodeKind;
  label: string;
  value: string;
  tone: Tone;
  /** Which way energy moves relative to the inverter: "in" = into it, "out" = away from it. */
  dir: "in" | "out" | "none";
  watts: number;
}

function fmtW(value: number | null): string {
  if (value === null) return "—";
  const w = Math.abs(value);
  return w >= 1000 ? `${(w / 1000).toFixed(w >= 10_000 ? 1 : 2)} kW` : `${Math.round(w)} W`;
}

function makeNode(
  id: string,
  kind: NodeKind,
  label: string,
  watts: number | null,
  socPct: number | null = null
): FlowNode {
  const w = watts ?? 0;
  let tone: Tone = "idle";
  let dir: FlowNode["dir"] = "none";
  if (kind === "solar" && w > 0) [tone, dir] = ["producing", "in"];
  else if (kind === "grid" && w > 0) [tone, dir] = ["drawing", "in"];
  else if (kind === "grid" && w < 0) [tone, dir] = ["producing", "out"];
  else if (kind === "generator" && w > 0) [tone, dir] = ["drawing", "in"];
  else if ((kind === "battery" || kind === "ups") && w > 0) [tone, dir] = ["producing", "out"];
  else if ((kind === "battery" || kind === "ups") && w < 0) [tone, dir] = ["drawing", "in"];
  else if ((kind === "home" || kind === "ev") && w > 0) [tone, dir] = ["consuming", "out"];
  const base = fmtW(watts);
  const value = (kind === "battery" || kind === "ups") && socPct !== null ? `${base} · ${Math.round(socPct)}%` : base;
  return { id, kind, label, value, tone, dir, watts: Math.abs(w) };
}

// power_package says which equipment a site actually has — a null value (not yet configured for an existing site)
// falls back to "don't hide anything". Its role is purely to additionally hide a node known not to exist; a live,
// non-null reading is still required for a node to show.
function hasSolarPackage(pkg: string | null): boolean {
  return pkg === null || pkg.includes("solar");
}
function hasBatteryPackage(pkg: string | null): boolean {
  return pkg === null || pkg.includes("battery");
}
function hasEvPackage(pkg: string | null): boolean {
  return pkg === null || pkg.includes("_ev") || pkg === "ev_charger_only";
}
// power_source_category is a separate, orthogonal site field (how the site connects to the utility) — it only ever
// hides the Grid node, and only for a genuinely off-grid site.
function hasGridSource(category: string | null): boolean {
  return category !== "off_grid";
}

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "producing", label: "Producing · charging · exporting" },
  { tone: "drawing", label: "Importing · discharging" },
  { tone: "consuming", label: "Consuming" },
  { tone: "idle", label: "Idle" },
];

export function EnergyFlowDiagram({
  solarW,
  batteryW,
  gridW,
  loadW,
  batterySocPct,
  evW = null,
  powerPackage = null,
  powerSourceCategory = null,
  extras = [],
}: {
  solarW: number | null;
  /** positive = charging, negative = discharging */
  batteryW: number | null;
  /** positive = importing, negative = exporting */
  gridW: number | null;
  loadW: number | null;
  batterySocPct: number | null;
  /** The site's EV charger, if it has one; omitted (no node, no line) when it has none or hasn't reported yet. */
  evW?: number | null;
  /** The site's configured equipment combination (sites.power_package). */
  powerPackage?: string | null;
  /** The site's grid connection type (sites.power_source_category). */
  powerSourceCategory?: string | null;
  /** More batteries / chargers, a generator or a UPS; each one gets its own node and line. */
  extras?: ExtraFlowNode[];
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");

  const nodes: FlowNode[] = [
    ...(hasSolarPackage(powerPackage) && solarW !== null ? [makeNode("solar", "solar", "Solar", solarW)] : []),
    ...(hasGridSource(powerSourceCategory) && gridW !== null ? [makeNode("grid", "grid", "Grid", gridW)] : []),
    ...(hasBatteryPackage(powerPackage) && batteryW !== null ? [makeNode("battery", "battery", "Battery", batteryW, batterySocPct)] : []),
    ...(loadW !== null ? [makeNode("home", "home", "Home", loadW)] : []),
    ...(hasEvPackage(powerPackage) && evW !== null ? [makeNode("ev", "ev", "EV Charger", evW)] : []),
    ...extras.map((x) => makeNode(x.id, x.kind, x.label || DEFAULT_LABEL[x.kind], x.watts, x.socPct ?? null)),
  ];

  const layout = layoutFlow(nodes, (n) => n.kind);
  const { width: W, height: H, hub } = layout;
  const pctX = (x: number) => `${(x / W) * 100}%`;
  const pctY = (y: number) => `${(y / H) * 100}%`;

  return (
    <div className="mx-auto w-full max-w-xl" role="group" aria-label="Energy flow">
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            {layout.nodes.map(({ item, anchor, hubAnchor }) => {
              const from = item.dir === "out" ? hubAnchor : anchor;
              const to = item.dir === "out" ? anchor : hubAnchor;
              const color = COLOR[item.tone];
              const active = item.dir !== "none";
              return (
                <linearGradient key={item.id} id={`${uid}-${item.id}`} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
                  <stop offset="0" stopColor={color} stopOpacity={active ? 0.95 : 0.4} />
                  <stop offset="0.6" stopColor={color} stopOpacity={active ? 0.6 : 0.28} />
                  <stop offset="1" stopColor={color} stopOpacity={active ? 0.18 : 0.1} />
                </linearGradient>
              );
            })}
          </defs>
          {layout.nodes.map(({ item, side, anchor, hubAnchor }) => {
            const from = item.dir === "out" ? hubAnchor : anchor;
            const to = item.dir === "out" ? anchor : hubAnchor;
            const d = curvePath(from, to, side === "top" || side === "bottom");
            const dur = `${Math.min(5, Math.max(1.6, 5 - item.watts / 3000)).toFixed(1)}s`;
            return (
              <g key={item.id}>
                <path d={d} fill="none" stroke={`url(#${uid}-${item.id})`} strokeWidth={2} strokeLinecap="round" />
                {item.dir !== "none" && (
                  <circle r={3} fill={COLOR[item.tone]} className="motion-reduce:hidden">
                    <animateMotion dur={dur} repeatCount="indefinite" path={d} />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.75;1" dur={dur} repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* The hub: the inverter every line meets. */}
        <div
          className="absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-theme-active bg-theme-surface"
          style={{ left: pctX(hub.x), top: pctY(hub.y), width: `${((2 * HUB_R) / W) * 100}%` }}
          title="Inverter"
        >
          <Server className="size-[42%] text-theme-secondary" strokeWidth={1.75} />
        </div>

        {layout.nodes.map(({ item, side, center }) => {
          const Icon = ICON[item.kind];
          const color = COLOR[item.tone];
          const idle = item.tone === "idle";
          const labelAbove = side === "top";
          return (
            <React.Fragment key={item.id}>
              <div
                className="absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-theme-surface"
                style={{
                  left: pctX(center.x),
                  top: pctY(center.y),
                  width: `${((2 * NODE_R) / W) * 100}%`,
                  borderColor: idle ? "var(--border)" : color,
                  boxShadow: idle ? undefined : `0 0 16px ${color}33`,
                }}
              >
                <Icon className={cn("size-[46%]", idle && "text-theme-muted")} style={idle ? undefined : { color }} strokeWidth={1.75} />
              </div>
              <div
                className={cn("absolute flex -translate-x-1/2 items-center whitespace-nowrap text-center", labelAbove ? "flex-col-reverse" : "flex-col")}
                style={{
                  left: pctX(center.x),
                  ...(labelAbove ? { bottom: pctY(H - (center.y - NODE_R - 6)) } : { top: pctY(center.y + NODE_R + 6) }),
                }}
              >
                <span className="text-[12px] sm:text-[13px] font-semibold leading-tight tabular-nums text-theme-primary">{item.value}</span>
                <span className="text-[10px] sm:text-[11px] leading-tight text-theme-muted">{item.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-theme-muted">
        {LEGEND.map((l) => (
          <li key={l.tone} className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: `linear-gradient(90deg, ${COLOR[l.tone]}, ${COLOR[l.tone]}1a)` }} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
