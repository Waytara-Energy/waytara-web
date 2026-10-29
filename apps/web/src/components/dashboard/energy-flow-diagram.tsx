"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BatteryCharging, CarFront, Fuel, Home, Server, ShieldCheck, Sun, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnits } from "@/components/units-provider";
import type { UnitPrefs } from "@/lib/unit-prefs";
import { badgeFor, homeSourceOf, type StateBadge } from "./energy-flow-badge";
import { curvePath, HUB_R, layoutFlow, NODE_R, type NodeKind } from "./energy-flow-layout";
import { fmtKw, lineWidth, summarize } from "./energy-flow-summary";

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
/** The colours and tones, for the colour key (flow-legend.tsx). */
export const FLOW_COLOR = COLOR;
export type FlowTone = Tone;

// The same icons the Monitoring tabs use for these things (the load keeps the Home Load tab's icon).
const ICON: Record<NodeKind, LucideIcon> = {
  solar: Sun,
  grid: Zap,
  generator: Fuel,
  battery: BatteryCharging,
  ups: ShieldCheck,
  home: Home,
  ev: CarFront,
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
  /** The charger node: its two label lines (power or status, then session and status) and whether it is offline. */
  evText?: { line1: string; line2: string };
  offline?: boolean;
}

function makeNode(
  id: string,
  kind: NodeKind,
  label: string,
  watts: number | null,
  socPct: number | null = null,
  homeSource: Parameters<typeof badgeFor>[2] = "idle",
  units?: UnitPrefs
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
  return { id, kind, label, value: fmtKw(watts, units), soc, badge: badgeFor(kind, watts, homeSource), tone, dir, watts: Math.abs(w) };
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

/**
 * The two lines under the charger's circle. Line 1: the live power while it is charging, otherwise its status. Line 2: the status with today's
 * charged energy ("Charging · 3.2 kWh today", "Available · 0.0 kWh today"); an offline charger just says "Offline".
 */
export function evLabel(evW: number | null, status: string | null, sessionKwh: number | null, connected: boolean | null | undefined, fmtPower: (w: number) => string = (w) => `${(w / 1000).toFixed(1)} kW`): { line1: string; line2: string } {
  if (connected === false) return { line1: "Offline", line2: "Offline" };
  const state = status && status.trim() ? status.trim() : "Idle";
  const today = sessionKwh === null ? null : `${sessionKwh.toFixed(1)} kWh today`;
  return {
    line1: evW !== null && evW > 0 ? fmtPower(evW) : state,
    line2: today ? `${state} · ${today}` : state,
  };
}

/** Half-length of the "not in use" cross, in drawing units. */
const CROSS = 8;
/** How many dots travel along an active line. */
const DOTS = 3;

export function EnergyFlowDiagram({
  solarW,
  batteryW,
  gridW,
  loadW,
  batterySocPct,
  evW = null,
  evInfo,
  onEvPress,
  powerPackage = null,
  powerSourceCategory = null,
  extras = [],
  fit = false,
  inverterId,
  chargerId,
  frozen = null,
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
  /** The charger's state for the circle's label: its connector status (Available, Preparing, Charging, Finishing, Faulted, or "Offline"), the energy it has delivered today, and whether the charger is connected. Given, the circle shows whenever the site has a charger. */
  evInfo?: { status: string | null; sessionKwh: number | null; connected?: boolean | null; sessionOpen?: boolean };
  /** A press on the charger circle (the Overview starts a charge, or opens Monitoring's EV tab while one runs); without it the circle opens that tab. */
  onEvPress?: () => void;
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
  /** The monitoring unit is offline / has lost the device: nothing flows, so the drawing stops (last readings, no moving
   *  dots, muted) and picks up again by itself when readings return. The page says why in a notice at the top (ConnectionNotice). */
  frozen?: "offline" | "connection_lost" | null;
}) {
  const router = useRouter();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const { prefs } = useUnits();

  const nodes: FlowNode[] = [
    // A circle is drawn when it has a reading, or - with no reading yet (the unit is offline, a new day without data) - when the site is known to have
    // that equipment (its package says so): it then stays in place, greyed, with "-" instead of vanishing and leaving a hub on its own.
    ...(hasSolarPackage(powerPackage) && (solarW !== null || powerPackage !== null) ? [makeNode("solar", "solar", "Solar", solarW, null, "idle", prefs)] : []),
    ...(hasGridSource(powerSourceCategory) && (gridW !== null || powerSourceCategory !== null) ? [makeNode("grid", "grid", "Grid", gridW, null, "idle", prefs)] : []),
    ...(hasBatteryPackage(powerPackage) && (batteryW !== null || powerPackage !== null) ? [makeNode("battery", "battery", "Battery", batteryW, batterySocPct, "idle", prefs)] : []),
    ...(loadW !== null || powerPackage !== null ? [makeNode("home", "home", "Load", loadW, null, homeSourceOf(loadW, solarW, batteryW, gridW), prefs)] : []),
    ...((evInfo || (hasEvPackage(powerPackage) && evW !== null))
      ? [
          {
            ...makeNode("ev", "ev", "EV Charger", evW, null, "idle", prefs),
            ...(evInfo ? { evText: evLabel(evW, evInfo.status, evInfo.sessionKwh, evInfo.connected, (w) => fmtKw(w, prefs)), offline: evInfo.connected === false } : {}),
          },
        ]
      : []),
    ...extras.map((x) => makeNode(x.id, x.kind, x.label || DEFAULT_LABEL[x.kind], x.watts, x.socPct ?? null, "idle", prefs)),
  ];

  const layout = layoutFlow(nodes, (n) => n.kind);
  const { width: W, height: H, hub } = layout;
  const pctX = (x: number) => `${(x / W) * 100}%`;
  const pctY = (y: number) => `${(y / H) * 100}%`;
  const summary = summarize(solarW, batteryW, gridW, loadW, prefs);
  // Each circle opens its own tab on the Monitoring page (the charger's circle opens the charger's page).
  const TAB: Record<NodeKind, string> = { solar: "solar", battery: "battery", ups: "battery", home: "load", grid: "grid", generator: "generator", ev: "ev" };
  const hrefFor = (kind: NodeKind | "hub"): string | null => {
    const device = kind === "ev" ? chargerId : inverterId;
    if (!device) return null;
    return `/dashboard/monitoring?device=${device}#${kind === "hub" ? "hub" : TAB[kind]}`;
  };
  // The charger is fed by the home load, not by the inverter directly: its line runs from the load circle down to the charger circle (the inverter
  // is used when there is no load circle).
  const homeEntry = layout.nodes.find((e) => e.item.kind === "home");
  const lineOf = (e: (typeof layout.nodes)[number]) => {
    if (e.item.id === "ev" && homeEntry) return { from: { x: homeEntry.center.x, y: homeEntry.center.y + NODE_R }, to: { x: e.center.x, y: e.center.y - NODE_R }, vertical: true };
    const from = e.item.dir === "out" ? e.hubAnchor : e.anchor;
    const to = e.item.dir === "out" ? e.anchor : e.hubAnchor;
    return { from, to, vertical: e.side === "top" || e.side === "bottom" };
  };
  const go = (href: string | null) => {
    if (href) router.push(href);
  };
  return (
    <div className={cn("mx-auto w-full", !fit && "max-w-xl")} role="group" aria-label="Energy flow">
      <div
        className="@container relative mx-auto w-full"
        style={{
          aspectRatio: `${W} / ${H}`,
          // fit: as large as the column allows, but never taller than the room the board leaves (--flow-h, set by the board; less
          // room the drawing's neighbours take).
          ...(fit ? { width: `min(100%, calc(var(--flow-h, calc(max(100svh - 14rem, 26rem) - 3.5rem)) * ${W / H}))` } : {}),
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className={cn("absolute inset-0 h-full w-full transition-opacity", frozen && "opacity-50 grayscale")} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-off`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fca5a5" />
              <stop offset="0.5" stopColor="#ef4444" />
              <stop offset="1" stopColor="#b91c1c" />
            </linearGradient>
            {layout.nodes.map((entry) => {
              const { item } = entry;
              const { from, to } = lineOf(entry);
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
          {layout.nodes.map((entry) => {
            const { item } = entry;
            const { from, to, vertical } = lineOf(entry);
            const d = curvePath(from, to, vertical);
            // A charger that is only idle shows a quiet grey line; the red cross is for a charger that is offline.
            const cross = item.id === "ev" && item.evText ? !!item.offline : item.dir === "none";
            const durS = Math.min(5, Math.max(1.6, 5 - item.watts / 3000));
            const dur = `${durS.toFixed(1)}s`;
            return (
              <g key={item.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#${uid}-${item.id})`}
                  strokeWidth={item.dir === "none" ? 2 : lineWidth(item.watts)}
                  strokeLinecap="round"
                />
                {cross && (
                  // Not in use: a red cross on the line, at its midpoint (a symmetric curve passes through the average of its ends).
                  <g transform={`translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2})`} style={{ filter: "drop-shadow(0 0 3px rgba(239,68,68,0.55))" }}>
                    <path d={`M -${CROSS} -${CROSS} L ${CROSS} ${CROSS} M -${CROSS} ${CROSS} L ${CROSS} -${CROSS}`} stroke={`url(#${uid}-off)`} strokeWidth={3} strokeLinecap="round" fill="none" />
                  </g>
                )}
                {item.dir !== "none" && !frozen &&
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

        {layout.nodes.map(({ item, side, center }) => {
          const Icon = ICON[item.kind];
          const color = COLOR[item.tone];
          const idle = item.tone === "idle";
          // The load's own label goes above its circle when a charger hangs below it (the line to the charger would run through the text), if there is room.
          const labelAbove = side === "top" || (item.kind === "home" && layout.nodes.some((n) => n.item.id === "ev") && center.y - NODE_R - 46 >= 0);
          const handlers = {
            onClick: () => (item.kind === "ev" && onEvPress ? onEvPress() : go(hrefFor(item.kind))),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (item.kind === "ev" && onEvPress) onEvPress();
                else go(hrefFor(item.kind));
              }
            },
          };
          return (
            <React.Fragment key={item.id}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`${item.label}: ${item.value}, ${item.badge.label}`}
                {...handlers}
                className="absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 bg-theme-surface outline-none focus-visible:ring-2 focus-visible:ring-theme-highlight"
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
                className="absolute flex -translate-x-1/2 cursor-pointer flex-col items-center whitespace-nowrap text-center"
                style={{
                  left: pctX(center.x),
                  ...(labelAbove ? { bottom: pctY(H - (center.y - NODE_R - 6)) } : { top: pctY(center.y + NODE_R + 6) }),
                }}
                {...handlers}
              >
                <span className="font-semibold leading-tight tabular-nums text-theme-primary" style={{ fontSize: "clamp(11px, 2.1cqw, 17px)" }}>
                  {item.evText ? item.evText.line1 : item.value}
                  {item.soc !== null && ` · ${item.soc}%`}
                </span>
                <span className="leading-tight text-theme-muted" style={{ fontSize: "clamp(10px, 1.7cqw, 14px)" }}>
                  {item.evText ? (
                    item.evText.line2
                  ) : (
                    <>
                      {item.label}
                      <span className="hidden font-medium @md:inline" style={{ color: idle ? "var(--text-muted)" : color }}>
                        {" · "}
                        {item.badge.label}
                      </span>
                    </>
                  )}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
