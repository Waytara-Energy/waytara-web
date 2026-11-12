"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { BatteryCharging, CarFront, Fuel, Home, Server, ShieldCheck, Sun, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import CrystalizedBall from "@/components/ui/crystalized-ball";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useUnits } from "@/components/units-provider";
import type { UnitPrefs } from "@/lib/unit-prefs";
import { badgeFor, homeSourceOf, type StateBadge } from "./energy-flow-badge";
import { curvePath, HUB_R, layoutFlow, NODE_R, type NodeKind } from "./energy-flow-layout";
import { fmtKw, summarize } from "./energy-flow-summary";
import { EnergyFlowCanvas, type FlowCanvasScene } from "./energy-flow-canvas";
import { BATTERYCHARGING_SHAPE, CARFRONT_SHAPE, FUEL_SHAPE, HOME_SHAPE, SERVER_SHAPE, SHIELDCHECK_SHAPE, SUN_SHAPE, ZAP_SHAPE, type IconShape } from "./flow-icon-shapes";

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
 * THE LOOK: like a phone showing that it is charging.
 *  - Each circle's RING is a Crystalized Ball (React Bits, ui/crystalized-ball.tsx) with no dust in it: only its rim, strands of light that crackle round
 *    the circle with flares, sparks and a glow, on a frosted disc. More power means more strands, more crackle, flares and sparks, more glow and speed; an
 *    idle circle is one faint, calm strand; an offline unit's rings are paused and grey. (A browser without WebGL 2 gets a plain ring instead: FlowRing.)
 *  - The ICON in the ring is made of small grains and nothing else (energy-flow-canvas.tsx): it shimmers, its lines get thicker with the power, it bursts
 *    when pointed at and gathers again.
 *  - The LINES carry BEAMS of light with sparks streaming along them the way the energy flows (also the canvas).
 * Colour keeps its meaning (green producing or storing, amber drawing on a source, blue going to a consumer, grey idle); the inverter takes the colour of
 * whatever is moving most.
 */
/** The grains and beams use a deeper shade of each colour on the light theme (the 600s, to stand out on white and on the sky) and a brighter one on the
 *  dark theme (the 400s, so they glow). */
const INK: Record<Tone, string> = { producing: "#059669", drawing: "#d97706", consuming: "#2563eb", idle: "#64748b" };
const LIT: Record<Tone, string> = { producing: "#34d399", drawing: "#fbbf24", consuming: "#60a5fa", idle: "#94a3b8" };
/** The power (in W) at which a circle works at full strength. */
const FULL_BURN_W = 5000;
/** The ring's thickness: it grows a little with the drawing (cqw is a hundredth of the drawing's width). */
const RING = "clamp(1.5px, 0.5cqw, 3px)";
const ringMask = (width: string) => {
  const m = `radial-gradient(farthest-side, transparent calc(100% - ${width} - 0.5px), #000 calc(100% - ${width}))`;
  return { maskImage: m, WebkitMaskImage: m };
};

/** The plain ring of one circle, for a browser that cannot draw the balls (drawn inside the circle's own element). */
function FlowRing({ color, active, level, soc, frozen, dark, hub = false }: { color: string; active: boolean; level: number; soc: number | null; frozen: boolean; dark: boolean; hub?: boolean }) {
  const moving = active && !frozen;
  // a streak that is clear for the first half of the turn and brightest at its head
  const streak = `conic-gradient(from 0deg, ${color}00 0%, ${color}00 42%, ${color}cc 88%, ${dark ? "#ffffff" : color} 100%)`;
  const turn = { animationDuration: `${((hub ? 5.2 : 4.2) - 2.3 * level).toFixed(2)}s` };
  return (
    <>
      {/* the ring itself, faint */}
      <span className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 ${RING} ${color}${moving ? "40" : "33"}` }} />
      {/* the battery's charge, as the lit part of the ring (from the top, clockwise) */}
      {soc !== null && <span className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color} ${soc}%, ${color}00 0)`, opacity: moving ? 0.75 : 0.5, ...ringMask(`calc(${RING} * 1.5)`) }} />}
      {moving && (
        <>
          {/* the streak's glow (the blurred element is the one that turns, so the browser only has to rotate a ready-made picture) */}
          <span className="absolute inset-[-6%] animate-spin rounded-full motion-reduce:animate-none" style={{ ...turn, filter: `blur(${hub ? 7 : 5}px)`, opacity: dark ? 0.85 : 0.55 }}>
            <span className="absolute inset-[5.4%] rounded-full" style={{ background: streak, ...ringMask(`calc(${RING} * 2.4)`) }} />
          </span>
          {/* the streak */}
          <span className="absolute inset-0 animate-spin rounded-full motion-reduce:animate-none" style={{ ...turn, background: streak, ...ringMask(`calc(${RING} * 1.25)`) }} />
        </>
      )}
      {/* the inverter has a second, fainter ring round it */}
      {hub && <span className="absolute inset-[-9%] rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${color}30` }} />}
    </>
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
// The same icons as drawings, for the balls to build out of grains.
const ICON_SHAPE: Record<NodeKind, IconShape> = {
  solar: SUN_SHAPE,
  grid: ZAP_SHAPE,
  generator: FUEL_SHAPE,
  battery: BATTERYCHARGING_SHAPE,
  ups: SHIELDCHECK_SHAPE,
  home: HOME_SHAPE,
  ev: CARFRONT_SHAPE,
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

/** The ball's canvas is this much wider than the circle it rings, to leave room for the crackle and flares round the rim. */
const BALL_SPAN = 1.4;

// Whether this browser can draw a ball (it needs WebGL 2). Asked once; if it cannot, the circles get the plain ring.
let webgl2Supported: boolean | null = null;
function canDrawBalls(): boolean {
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

type Spot = { left: string; top: string; width: string };

/** The frosted disc behind a circle, so its icon reads on whatever is behind (the page, the sky, a person's own picture), with a little light inside. */
function FlowDisc({ spot, color, moving }: { spot: Spot; color: string; moving: boolean }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/55 backdrop-blur-[3px]" style={spot}>
      <span className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 50% 58%, ${color}${moving ? "2b" : "12"} 0%, ${color}00 72%)` }} />
    </span>
  );
}

/** The ring of one circle: the rim of a Crystalized Ball (no dust). `level` 0 to 1 is how hard the circle works. */
function FlowBall({ spot, color, level, active, frozen, dark, hub = false }: { spot: Spot; color: string; level: number; active: boolean; frozen: boolean; dark: boolean; hub?: boolean }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 transition-[filter,opacity] duration-500", frozen && "opacity-60 grayscale")} style={spot}>
      <CrystalizedBall
        preset="plasma"
        color={color}
        theme={dark ? "dark" : "light"}
        size={1 / BALL_SPAN}
        strands={active ? (hub ? 3 : 2) + Math.round((hub ? 3 : 4) * level) : 1}
        crackle={active ? 0.35 + 0.65 * level : 0.12}
        flares={active ? 0.25 + 0.6 * level : 0.08}
        glow={active ? 0.6 + 0.6 * level : 0.3}
        sparks={active ? 0.2 + 0.7 * level : 0}
        // no dust: the circle holds its icon and nothing else
        particleCount={0}
        fill={0.5}
        motion="drift"
        particleShape="square"
        depth={0.6}
        sway={0}
        twinkle={0}
        haze={active ? 0.35 : 0.15}
        speed={active ? 0.5 + 0.8 * level : 0.2}
        dustSpeed={0}
        interactive
        hoverStrength={hub ? 0.9 : 0.7}
        intro
        paused={frozen}
      />
    </div>
  );
}

/** Half-length of the "offline" cross, in drawing units. */
const CROSS = 6;
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
  /** (Not used: a click on a circle goes nowhere.) */
  inverterId?: string;
  chargerId?: string;
  /** The monitoring unit is offline / has lost the device: nothing flows, so the drawing stops (last readings, no moving
   *  dots, muted) and picks up again by itself when readings return. The page says why in a notice at the top (ConnectionNotice). */
  frozen?: "offline" | "connection_lost" | null;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const { prefs } = useUnits();
  // The moving part (the grains and the drops) is a canvas, which only exists in the browser: until it is there the plain icons show.
  const live = useHasMounted();
  // The balls are only alive while the drawing is on screen: each is its own WebGL picture (a browser allows about sixteen), and the Overview keeps one
  // drawing per device side by side, so a slide that is scrolled away lets its balls go and gets them back (with their short intro) when it returns.
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = React.useState(false);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const watcher = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { rootMargin: "80px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  // Assumed to work until the browser says it cannot.
  const ballsOk = React.useSyncExternalStore(subscribeNever, canDrawBalls, () => true);
  const { resolvedTheme } = useTheme();
  // (Known only in the browser: the server-built page, and the first paint, take the light look.)
  const dark = live && resolvedTheme === "dark";

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
  // The inverter takes the tone of whatever is moving most, and works as hard as that does.
  const busiest = nodes.reduce<FlowNode | null>((best, n) => (n.dir !== "none" && (!best || n.watts > best.watts) ? n : best), null);
  const hubLevel = busiest ? Math.min(1, Math.sqrt(busiest.watts / FULL_BURN_W)) : 0;
  const { width: W, height: H, hub } = layout;
  const pctX = (x: number) => `${(x / W) * 100}%`;
  const pctY = (y: number) => `${(y / H) * 100}%`;
  const summary = summarize(solarW, batteryW, gridW, loadW, prefs);
  // The charger is fed by the home load, not by the inverter directly: its line runs from the load circle down to the charger circle (the inverter
  // is used when there is no load circle).
  const homeEntry = layout.nodes.find((e) => e.item.kind === "home");
  const lineOf = (e: (typeof layout.nodes)[number]) => {
    if (e.item.id === "ev" && homeEntry) return { from: { x: homeEntry.center.x, y: homeEntry.center.y + NODE_R }, to: { x: e.center.x, y: e.center.y - NODE_R }, vertical: true };
    const from = e.item.dir === "out" ? e.hubAnchor : e.anchor;
    const to = e.item.dir === "out" ? e.anchor : e.hubAnchor;
    return { from, to, vertical: e.side === "top" || e.side === "bottom" };
  };
  const levelOf = (watts: number) => Math.min(1, Math.sqrt(watts / FULL_BURN_W));
  // The colour of a circle's grains and drops, and how thick its icon's lines are: thin when idle, thicker the more power moves (in quarter steps).
  const paint = (tone: Tone) => (frozen ? COLOR.idle : dark ? LIT[tone] : INK[tone]);
  const strokeOf = (active: boolean, level: number) => (active ? Math.round((1.6 + 1.5 * level) * 4) / 4 : 1.4);
  // An offline charger moves nothing, whatever its last reading says.
  const flows = (n: FlowNode) => n.dir !== "none" && !n.offline;
  const scene: FlowCanvasScene = {
    width: W,
    height: H,
    frozen: !!frozen,
    dark,
    nodes: [
      { id: "hub", center: hub, radius: HUB_R, color: paint(busiest ? busiest.tone : "idle"), icon: SERVER_SHAPE, stroke: strokeOf(!!busiest, hubLevel), iconScale: 0.42, port: null, dir: busiest ? "in" : "none", level: hubLevel },
      ...layout.nodes.map((e) => ({
        id: e.item.id,
        center: e.center,
        radius: NODE_R,
        color: paint(flows(e.item) ? e.item.tone : "idle"),
        icon: ICON_SHAPE[e.item.kind],
        stroke: strokeOf(flows(e.item), levelOf(e.item.watts)),
        iconScale: 0.5,
        // where its line meets it (the charger's line comes down from the load)
        port: e.item.id === "ev" && homeEntry ? { x: e.center.x, y: e.center.y - NODE_R } : e.anchor,
        dir: flows(e.item) ? e.item.dir : ("none" as const),
        level: levelOf(e.item.watts),
      })),
    ],
    lines: layout.nodes.map((e) => ({ id: e.item.id, ...lineOf(e), color: paint(e.item.tone), active: flows(e.item), level: levelOf(e.item.watts) })),
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
        {/* Under everything: each circle's frosted disc, and its ring (the rim of a ball of light). */}
        <FlowDisc spot={{ left: pctX(hub.x), top: pctY(hub.y), width: `${((2 * HUB_R) / W) * 100}%` }} color={frozen ? COLOR.idle : COLOR[busiest ? busiest.tone : "idle"]} moving={!!busiest && !frozen} />
        {layout.nodes.map(({ item, center }) => (
          <FlowDisc key={item.id} spot={{ left: pctX(center.x), top: pctY(center.y), width: `${((2 * NODE_R) / W) * 100}%` }} color={frozen || !flows(item) ? COLOR.idle : COLOR[item.tone]} moving={flows(item) && !frozen} />
        ))}
        {ballsOk && live && onScreen && (
          <>
            <FlowBall
              hub
              spot={{ left: pctX(hub.x), top: pctY(hub.y), width: `${((2 * HUB_R * BALL_SPAN) / W) * 100}%` }}
              color={frozen ? COLOR.idle : COLOR[busiest ? busiest.tone : "idle"]}
              level={hubLevel}
              active={!!busiest}
              frozen={!!frozen}
              dark={dark}
            />
            {layout.nodes.map(({ item, center }) => (
              <FlowBall
                key={item.id}
                spot={{ left: pctX(center.x), top: pctY(center.y), width: `${((2 * NODE_R * BALL_SPAN) / W) * 100}%` }}
                color={frozen || !flows(item) ? COLOR.idle : COLOR[item.tone]}
                level={levelOf(item.watts)}
                active={flows(item)}
                frozen={!!frozen}
                dark={dark}
              />
            ))}
          </>
        )}

        {/* The lines: hairlines. The energy on them (the beams) is drawn by the canvas. */}
        <svg viewBox={`0 0 ${W} ${H}`} className={cn("absolute inset-0 h-full w-full transition-opacity", frozen && "opacity-50 grayscale")} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-off`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fca5a5" />
              <stop offset="0.5" stopColor="#ef4444" />
              <stop offset="1" stopColor="#b91c1c" />
            </linearGradient>
          </defs>
          {layout.nodes.map((entry) => {
            const { item } = entry;
            const { from, to, vertical } = lineOf(entry);
            const active = flows(item);
            return (
              <g key={item.id}>
                {/* in use: a fine line in the flow's colour; not in use: a fainter, dotted one */}
                <path
                  d={curvePath(from, to, vertical)}
                  fill="none"
                  stroke={active ? COLOR[item.tone] : COLOR.idle}
                  strokeOpacity={active ? 0.3 : 0.45}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeDasharray={active ? undefined : "0.5 6"}
                />
                {item.offline && (
                  // An offline charger: a small red cross on its line, at the midpoint (a symmetric curve passes through the average of its ends).
                  <g transform={`translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2})`}>
                    <path d={`M -${CROSS} -${CROSS} L ${CROSS} ${CROSS} M -${CROSS} ${CROSS} L ${CROSS} -${CROSS}`} stroke={`url(#${uid}-off)`} strokeWidth={2.4} strokeLinecap="round" fill="none" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* The hub: the inverter every line meets. */}
        <div
          role="img"
          aria-label={`Inverter: ${summary.text}`}
          className="absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 cursor-default flex-col items-center justify-center rounded-full outline-none"
          style={{ left: pctX(hub.x), top: pctY(hub.y), width: `${((2 * HUB_R) / W) * 100}%` }}
        >
          {!ballsOk && <FlowRing hub color={frozen ? COLOR.idle : COLOR[busiest ? busiest.tone : "idle"]} active={!!busiest} level={hubLevel} soc={null} frozen={!!frozen} dark={dark} />}
          {/* (The plain icon holds the place and shows until the canvas draws the icon in grains.) */}
          <Server className="relative size-[38%] text-theme-secondary transition-opacity duration-700" strokeWidth={1.75} style={{ opacity: live ? 0 : 1 }} />
        </div>

        {layout.nodes.map(({ item, side, center }) => {
          const Icon = ICON[item.kind];
          const color = COLOR[item.tone];
          const idle = item.tone === "idle";
          // The load's own label goes above its circle when a charger hangs below it (the line to the charger would run through the text), if there is room.
          const labelAbove = side === "top" || (item.kind === "home" && layout.nodes.some((n) => n.item.id === "ev") && center.y - NODE_R - 46 >= 0);
          // A click on a circle goes nowhere (only the charger's, when the page gives it something to do).
          const press = item.kind === "ev" && onEvPress ? onEvPress : null;
          const handlers = press
            ? {
                onClick: press,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    press();
                  }
                },
              }
            : {};
          return (
            <React.Fragment key={item.id}>
              <div
                {...(press ? { role: "button", tabIndex: 0 } : { role: "img" })}
                aria-label={`${item.label}: ${item.value}, ${item.badge.label}`}
                {...handlers}
                className={cn("absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-theme-highlight", press ? "cursor-pointer" : "cursor-default")}
                style={{ left: pctX(center.x), top: pctY(center.y), width: `${((2 * NODE_R) / W) * 100}%` }}
              >
                {!ballsOk && <FlowRing color={frozen || !flows(item) ? COLOR.idle : color} active={flows(item)} level={levelOf(item.watts)} soc={item.soc} frozen={!!frozen} dark={dark} />}
                <Icon className={cn("relative size-[46%] transition-opacity duration-700", idle && "text-theme-muted")} style={{ ...(idle ? {} : { color }), opacity: live ? 0 : 1 }} strokeWidth={1.75} />
              </div>
              <div
                className={cn("absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap text-center", press ? "cursor-pointer" : "pointer-events-none")}
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

        {/* The icons' grains and the drops on the lines. */}
        {live && <EnergyFlowCanvas scene={scene} className={cn("pointer-events-none absolute inset-0 h-full w-full transition-opacity", frozen && "opacity-60")} />}
      </div>
    </div>
  );
}
