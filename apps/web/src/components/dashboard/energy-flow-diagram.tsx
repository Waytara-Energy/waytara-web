"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BatteryCharging, Fuel, Home, Plug, Server, ShieldCheck, Sun, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { badgeFor, homeSourceOf, type StateBadge } from "./energy-flow-badge";
import { insightFor, type FlowReadings } from "./energy-flow-insight";
import { curvePath, HUB_R, layoutFlow, NODE_R, type NodeKind } from "./energy-flow-layout";
import { fmtKw, lineWidth, summarize } from "./energy-flow-summary";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Colors encode *direction*, not identity: green = producing or storing (solar producing, battery charging),
 *  amber = drawing on a source (grid import, battery discharging, generator), blue = energy leaving to a consumer
 *  (load, EV charger, exporting to the grid), slate = idle. */
const COLOR = {
  producing: "#10b981", // emerald-500
  drawing: "#f59e0b", // amber-500
  consuming: "#3b82f6", // blue-500
  idle: "#94a3b8", // slate-400
} as const;
type Tone = keyof typeof COLOR;

// The same icons the Monitoring tabs use for these things (the load keeps the Home Load tab's icon).
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
  home: "Load",
  ev: "EV Charger",
};

/** Something beyond the primary solar / battery / grid / load / EV set: more batteries or chargers, a generator, a UPS. */
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
  /** Battery / UPS charge, shown after the label. */
  soc: number | null;
  badge: StateBadge;
  tone: Tone;
  /** Which way energy moves relative to the inverter: "in" = into it, "out" = away from it. */
  dir: "in" | "out" | "none";
  watts: number;
}

function makeNode(
  id: string,
  kind: NodeKind,
  label: string,
  watts: number | null,
  socPct: number | null = null,
  homeSource: Parameters<typeof badgeFor>[2] = "idle"
): FlowNode {
  const w = watts ?? 0;
  let tone: Tone = "idle";
  let dir: FlowNode["dir"] = "none";
  if (kind === "solar" && w > 0) [tone, dir] = ["producing", "in"];
  else if (kind === "grid" && w > 0) [tone, dir] = ["drawing", "in"];
  else if (kind === "grid" && w < 0) [tone, dir] = ["consuming", "out"];
  else if (kind === "generator" && w > 0) [tone, dir] = ["drawing", "in"];
  else if ((kind === "battery" || kind === "ups") && w > 0) [tone, dir] = ["producing", "out"];
  else if ((kind === "battery" || kind === "ups") && w < 0) [tone, dir] = ["drawing", "in"];
  else if ((kind === "home" || kind === "ev") && w > 0) [tone, dir] = ["consuming", "out"];
  const soc = (kind === "battery" || kind === "ups") && socPct !== null ? Math.round(socPct) : null;
  return { id, kind, label, value: fmtKw(watts), soc, badge: badgeFor(kind, watts, homeSource), tone, dir, watts: Math.abs(w) };
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

/** Half-length of the "not in use" cross, in drawing units. */
const CROSS = 8;
/** How many dots travel along an active line. */
const DOTS = 3;

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "producing", label: "Producing · charging" },
  { tone: "drawing", label: "Importing · discharging" },
  { tone: "consuming", label: "Consuming · exporting" },
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
  fit = false,
  pvInputs = [],
  inverterId,
  chargerId,
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
  /** Size the drawing to the screen's height so the whole Overview fits without scrolling. */
  fit?: boolean;
  /** The solar inputs one by one (PV1, PV2 ...), for the solar circle's tooltip. */
  pvInputs?: { label: string; watts: number | null }[];
  /** Where a click on a circle goes: the matching tab of that device's Monitoring page. Without them circles don't link. */
  inverterId?: string;
  chargerId?: string;
}) {
  const router = useRouter();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  // Tapping or hovering a circle lights its line up and dims the rest.
  const [focus, setFocus] = React.useState<string | null>(null);

  const nodes: FlowNode[] = [
    ...(hasSolarPackage(powerPackage) && solarW !== null ? [makeNode("solar", "solar", "Solar", solarW)] : []),
    ...(hasGridSource(powerSourceCategory) && gridW !== null ? [makeNode("grid", "grid", "Grid", gridW)] : []),
    ...(hasBatteryPackage(powerPackage) && batteryW !== null ? [makeNode("battery", "battery", "Battery", batteryW, batterySocPct)] : []),
    ...(loadW !== null ? [makeNode("home", "home", "Load", loadW, null, homeSourceOf(loadW, solarW, batteryW, gridW))] : []),
    ...(hasEvPackage(powerPackage) && evW !== null ? [makeNode("ev", "ev", "EV Charger", evW)] : []),
    ...extras.map((x) => makeNode(x.id, x.kind, x.label || DEFAULT_LABEL[x.kind], x.watts, x.socPct ?? null)),
  ];

  const layout = layoutFlow(nodes, (n) => n.kind);
  const { width: W, height: H, hub } = layout;
  const pctX = (x: number) => `${(x / W) * 100}%`;
  const pctY = (y: number) => `${(y / H) * 100}%`;
  const summary = summarize(solarW, batteryW, gridW, loadW);
  // Each circle opens its own tab on the Monitoring page (the charger's circle opens the charger's page).
  const TAB: Record<NodeKind, string> = { solar: "solar", battery: "battery", ups: "battery", home: "load", grid: "grid", generator: "generator", ev: "hub" };
  const hrefFor = (kind: NodeKind | "hub"): string | null => {
    const device = kind === "ev" ? chargerId : inverterId;
    if (!device) return null;
    return `/dashboard/monitoring?device=${device}#${kind === "hub" ? "hub" : TAB[kind]}`;
  };
  const go = (href: string | null) => {
    if (href) router.push(href);
  };
  const readings: FlowReadings = { solarW, batteryW, gridW, loadW, evW, pvInputs };
  const primary = new Set(["solar", "grid", "battery", "home", "ev"]);

  return (
    <div className={cn("mx-auto w-full", !fit && "max-w-xl")} role="group" aria-label="Energy flow">
      <div
        className="@container relative mx-auto w-full"
        style={{
          aspectRatio: `${W} / ${H}`,
          // fit: as large as the column allows, but never taller than the board (less room for this drawing's colour key).
          ...(fit ? { width: `min(100%, calc((max(100svh - 14rem, 26rem) - 3.5rem) * ${W / H}))` } : {}),
        }}
        onPointerLeave={() => setFocus(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-off`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fca5a5" />
              <stop offset="0.5" stopColor="#ef4444" />
              <stop offset="1" stopColor="#b91c1c" />
            </linearGradient>
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
            const durS = Math.min(5, Math.max(1.6, 5 - item.watts / 3000));
            const dur = `${durS.toFixed(1)}s`;
            const dim = focus !== null && focus !== item.id;
            const lit = focus === item.id;
            return (
              <g key={item.id} className="transition-opacity" opacity={dim ? 0.2 : 1}>
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#${uid}-${item.id})`}
                  strokeWidth={item.dir === "none" ? 2 : lineWidth(item.watts) + (lit ? 1 : 0)}
                  strokeLinecap="round"
                />
                {item.dir === "none" && (
                  // Not in use: a red cross on the line, at its midpoint (a symmetric curve passes through the average of its ends).
                  <g transform={`translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2})`} style={{ filter: "drop-shadow(0 0 3px rgba(239,68,68,0.55))" }}>
                    <title>{`${item.label}: not in use`}</title>
                    <path d={`M -${CROSS} -${CROSS} L ${CROSS} ${CROSS} M -${CROSS} ${CROSS} L ${CROSS} -${CROSS}`} stroke={`url(#${uid}-off)`} strokeWidth={3} strokeLinecap="round" fill="none" />
                  </g>
                )}
                {item.dir !== "none" &&
                  // Dots streaming the way the energy moves; faster for more power.
                  Array.from({ length: DOTS }, (_, i) => {
                    const begin = `${(-(i * durS) / DOTS).toFixed(2)}s`;
                    return (
                      <circle key={i} r={2.6} fill={COLOR[item.tone]} className="motion-reduce:hidden">
                        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={d} />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={dur} begin={begin} repeatCount="indefinite" />
                      </circle>
                    );
                  })}
              </g>
            );
          })}
        </svg>

        {/* The hub: the inverter every line meets, with the site's overall mode at larger sizes. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              tabIndex={0}
              onClick={() => go(hrefFor("hub"))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  go(hrefFor("hub"));
                }
              }}
              aria-label={`Inverter: ${summary.text}`}
              className="absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 cursor-default flex-col items-center justify-center rounded-full border-2 bg-theme-surface outline-none focus-visible:ring-2 focus-visible:ring-theme-highlight border-theme-active"
              style={{ left: pctX(hub.x), top: pctY(hub.y), width: `${((2 * HUB_R) / W) * 100}%` }}
            >
              <Server className="size-[38%] text-theme-secondary @md:size-[32%]" strokeWidth={1.75} />
              <span className="mt-0.5 hidden font-medium leading-none text-theme-secondary @md:block" style={{ fontSize: "clamp(8px, 1.3cqw, 11px)" }}>
                {summary.mode}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64">
            <span className="block font-medium">Inverter</span>
            <span className="block opacity-80">{summary.text}</span>
          </TooltipContent>
        </Tooltip>

        {layout.nodes.map(({ item, side, center }) => {
          const Icon = ICON[item.kind];
          const color = COLOR[item.tone];
          const idle = item.tone === "idle";
          const labelAbove = side === "top";
          const dim = focus !== null && focus !== item.id;
          // A mouse lights the line only while it is over this circle or its label; a finger taps to light / unlight it.
          const handlers = {
            onPointerEnter: (e: React.PointerEvent) => {
              if (e.pointerType === "mouse") setFocus(item.id);
            },
            onPointerLeave: (e: React.PointerEvent) => {
              if (e.pointerType === "mouse") setFocus((f) => (f === item.id ? null : f));
            },
            onClick: () => go(hrefFor(item.kind)),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                go(hrefFor(item.kind));
              }
            },
          };
          return (
            <React.Fragment key={item.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.label}: ${item.value}, ${item.badge.label}`}
                    onFocus={() => setFocus(item.id)}
                    onBlur={() => setFocus(null)}
                    {...handlers}
                    className={cn(
                      "absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 bg-theme-surface outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-theme-highlight",
                      dim && "opacity-30"
                    )}
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
                </TooltipTrigger>
                <TooltipContent side={labelAbove ? "top" : "bottom"} className="max-w-64">
                  {/* What the circle does for the rest of the site; its power and state are already written beside it. */}
                  {(() => {
                    const insight = primary.has(item.id) ? insightFor(item.kind, readings) : { headline: item.badge.description, rows: [] };
                    return (
                      <>
                        <span className="block font-medium">{insight.headline}</span>
                        {insight.rows.length > 0 && (
                          <span className="mt-1 block space-y-0.5">
                            {insight.rows.map((row) => (
                              <span key={row.label} className="flex justify-between gap-6 tabular-nums opacity-80">
                                <span>{row.label}</span>
                                <span>{row.value}</span>
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </TooltipContent>
              </Tooltip>
              <div
                className={cn("absolute flex -translate-x-1/2 cursor-pointer flex-col items-center whitespace-nowrap text-center transition-opacity", dim && "opacity-30")}
                style={{
                  left: pctX(center.x),
                  ...(labelAbove ? { bottom: pctY(H - (center.y - NODE_R - 6)) } : { top: pctY(center.y + NODE_R + 6) }),
                }}
                {...handlers}
              >
                <span className="font-semibold leading-tight tabular-nums text-theme-primary" style={{ fontSize: "clamp(11px, 2.1cqw, 17px)" }}>
                  {item.value}
                  {item.soc !== null && ` · ${item.soc}%`}
                </span>
                <span className="leading-tight text-theme-muted" style={{ fontSize: "clamp(10px, 1.7cqw, 14px)" }}>
                  {item.label}
                  <span className="hidden font-medium @md:inline" style={{ color: idle ? "var(--text-muted)" : color }}>
                    {" · "}
                    {item.badge.label}
                  </span>
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-theme-muted">
        {LEGEND.map((l) => (
          <li key={l.tone} className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: `linear-gradient(90deg, ${COLOR[l.tone]}, ${COLOR[l.tone]}1a)` }} />
            {l.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <svg viewBox="-6 -6 12 12" className="size-3" aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-offl`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fca5a5" />
                <stop offset="0.5" stopColor="#ef4444" />
                <stop offset="1" stopColor="#b91c1c" />
              </linearGradient>
            </defs>
            <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" stroke={`url(#${uid}-offl)`} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          </svg>
          Not in use
        </li>
      </ul>
    </div>
  );
}
