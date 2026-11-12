"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BatteryCharging, CarFront, Fuel, Home, Server, ShieldCheck, Sun, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Orb from "@/components/ui/orb";
import { useHasMounted } from "@/hooks/use-has-mounted";
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
/**
 * Each circle is an Orb (React Bits): a living ring of light drawn behind the icon. Its three colours are the circle's tone (bright, base, deep); the
 * inverter's is all three flow colours at once. How much power moves decides how hard it burns: glow, wobble of the ring, the orbiting highlight, its trail
 * and its speed all rise with the power, and a circle with energy moving is held in the "awake" state (brighter, turning slowly). An idle circle is a
 * calm, dim grey ring, and when the unit is offline the rings are frozen (one still frame, greyed).
 */
const ORB_COLORS: Record<Tone, [string, string, string]> = {
  producing: ["#6ee7b7", COLOR.producing, "#047857"],
  drawing: ["#fcd34d", COLOR.drawing, "#b45309"],
  consuming: ["#93c5fd", COLOR.consuming, "#1d4ed8"],
  idle: ["#cbd5e1", COLOR.idle, "#475569"],
};
const HUB_ORB_COLORS: [string, string, string] = [COLOR.producing, COLOR.consuming, COLOR.drawing];
/** The ring of an Orb sits at 0.8 of its half-width, so its canvas is this much wider than the circle it rings. */
const ORB_SPAN = 1 / 0.8;
/** The power (in W) at which a circle burns at full strength. */
const FULL_BURN_W = 5000;
/** The orb is drawn for the dark path of its shader (a transparent glow), on both themes, so it sits on whatever is behind the diagram (the page, or the Overview's sky). */
const ORB_BACKGROUND = "#000000";

// Whether this browser can draw an Orb (it needs WebGL 2). Asked once; if it cannot, the circles keep their plain look (a border and a solid fill).
let webgl2Supported: boolean | null = null;
function canDrawOrbs(): boolean {
  if (webgl2Supported === null) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      webgl2Supported = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2Supported = false;
    }
  }
  return webgl2Supported;
}
const subscribeNever = () => () => undefined;

/** The orb behind one circle: `radius` is the circle's radius in drawing units, `level` is 0 to 1 (how hard it burns), `active` is whether energy moves. */
function FlowOrb({
  at,
  radius,
  width,
  colors,
  level,
  active,
  frozen,
  hub = false,
}: {
  at: { left: string; top: string };
  radius: number;
  width: number;
  colors: [string, string, string];
  level: number;
  active: boolean;
  frozen: boolean;
  hub?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 transition-[filter,opacity] duration-500", frozen && "opacity-60 grayscale")}
      style={{ left: at.left, top: at.top, width: `${((2 * radius * ORB_SPAN) / width) * 100}%` }}
    >
      <Orb
        colors={colors}
        hue={0}
        backgroundColor={ORB_BACKGROUND}
        size={1}
        glow={active ? 0.75 + 1.15 * level : 0.55}
        bleed={1}
        wobble={active ? 0.45 + 1.1 * level : 0.3}
        highlight={active ? 0.9 + 0.8 * level : 0.25}
        trail={active ? 1.2 : 0.4}
        tiltX={0}
        tiltY={0}
        speed={active ? 0.45 + 0.9 * level : 0.2}
        hoverIntensity={hub ? 1.3 : 1}
        rotateOnHover
        forceHoverState={active && !frozen}
        followCursor
        clickPulse
        intro
        opacity={active ? 1 : 0.65}
        paused={frozen}
        dpr={1.5}
      />
    </div>
  );
}

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
  // The orbs are only alive while the drawing is on screen: each is its own WebGL context (a browser allows about sixteen), and the Overview keeps
  // one drawing per device, side by side, so a slide that is scrolled away lets its orbs go and gets them back (with their short intro) when it returns.
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = React.useState(false);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const watcher = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { rootMargin: "80px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  // Assumed to work until the browser says it cannot (so the first paint has the orb look, not the plain one).
  const orbsOk = React.useSyncExternalStore(subscribeNever, canDrawOrbs, () => true);
  const mounted = useHasMounted();

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
        ref={rootRef}
        className="@container relative mx-auto w-full"
        style={{
          aspectRatio: `${W} / ${H}`,
          // fit: as large as the column allows, but never taller than the room the board leaves (--flow-h, set by the board; less
          // room the drawing's neighbours take).
          ...(fit ? { width: `min(100%, calc(var(--flow-h, calc(max(100svh - 14rem, 26rem) - 3.5rem)) * ${W / H}))` } : {}),
        }}
      >
        {/* The orbs, under the lines and the icons. */}
        {orbsOk && onScreen && mounted && (
          <>
            <FlowOrb
              hub
              at={{ left: pctX(hub.x), top: pctY(hub.y) }}
              radius={HUB_R}
              width={W}
              colors={frozen ? ORB_COLORS.idle : HUB_ORB_COLORS}
              level={Math.min(1, Math.sqrt(Math.max(0, ...nodes.map((n) => n.watts)) / FULL_BURN_W))}
              active={nodes.some((n) => n.dir !== "none")}
              frozen={!!frozen}
            />
            {layout.nodes.map(({ item, center }) => (
              <FlowOrb
                key={item.id}
                at={{ left: pctX(center.x), top: pctY(center.y) }}
                radius={NODE_R}
                width={W}
                colors={frozen ? ORB_COLORS.idle : ORB_COLORS[item.tone]}
                level={Math.min(1, Math.sqrt(item.watts / FULL_BURN_W))}
                active={item.dir !== "none"}
                frozen={!!frozen}
              />
            ))}
          </>
        )}

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
          className={cn(
            "absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 cursor-default flex-col items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-theme-highlight",
            !orbsOk && "border-2 border-theme-active bg-theme-surface"
          )}
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
                className={cn(
                  "absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-theme-highlight",
                  !orbsOk && "border-2 bg-theme-surface"
                )}
                style={{
                  left: pctX(center.x),
                  top: pctY(center.y),
                  width: `${((2 * NODE_R) / W) * 100}%`,
                  ...(orbsOk ? {} : { borderColor: idle ? "var(--border)" : color, boxShadow: idle ? undefined : `0 0 16px ${color}33` }),
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
