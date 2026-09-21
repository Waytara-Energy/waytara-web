import Image from "next/image";

/** Colors are deliberately not the app's categorical palette — they encode
 *  *direction*, not identity: green = flowing toward self-sufficiency
 *  (exporting surplus, battery charging), amber = drawing from the grid or
 *  the battery (still normal operation, just informational), slate = idle.
 *  Unchanged from the previous arrow-based version. */
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

function fmtW(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(Math.abs(value)).toLocaleString("en-IN")} W`;
}

// ---------------------------------------------------------------------------
// One house photo for both themes — only the overlay colors (leader lines,
// title/value text) switch with the theme; the image and every traced wire
// coordinate below are shared. Points were read off zoomed, grid-labeled
// crops of the actual photo (canvas-drawn crop + a coordinate grid overlaid
// every 10–100px, cross-checked by overlaying the traced path back onto the
// source pixels), not eyeballed.
const IMAGE_SRC = "/images/energy-flow-house-2.jpg";
const IMAGE_ALT =
  "Isometric illustration of a house with rooftop solar, a wall-mounted battery and inverter, and an attached EV charging bay";
const VIEW_W = 3850;
const VIEW_H = 3998;

// The cable exits at a small angled clip right at the roof ridge cap — it
// leans in from SOLAR_TOP, bends at the base of that cap (SOLAR_BEND), then
// runs straight down the wall to the inverter.
const SOLAR_TOP: Point = { x: 1723, y: 1518 };
const SOLAR_BEND: Point = { x: 1768, y: 1590 };
const INVERTER_TOP: Point = { x: 1765, y: 1945 }
const INVERTER_BOTTOM: Point = { x: 1765, y: 2300 };
const BATTERY_JUNCTION: Point = { x: 1955, y: 2110 };
// The lit cable runs along the wall face and bends sharply at the wall's
// corner edge (x≈2295) before continuing, unlit, around to the battery unit
// on the adjoining face — a straight line from junction to entry cut the
// corner instead of following that bend.
const BATTERY_BEND: Point = { x: 2335, y: 2075 };
const BATTERY_ENTRY: Point = { x: 2400, y: 2080 };
// There's a real cable baked into this photo running straight down from the
// inverter to the ground — glowing green from inverterBottom down to
// (1755, 2600), then a dark cable that bends there and curves right, fading
// into the ground shadow around (1870, 2680).
const GRID_BEND: Point = { x: 1765, y: 2660 };
const GRID_EXIT: Point = { x: 1980, y: 2680 };
// Another real cable exits the inverter box on its left side, running down
// toward the gable wall — glowing green, bending at the wall corner
// (x≈1090), then fading to a dark rounded cap at (985, 2210) without ever
// reaching the window. The wire itself still ends there, but the label's
// pointer is aimed at the window instead (HOME_LABEL_ANCHOR, below) — the
// window is the more recognizable "this is the house's own consumption"
// landmark than an unlabeled cable cap on the wall.
const HOME_JUNCTION: Point = { x: 1650, y: 2139 };
const HOME_BEND: Point = { x: 1090, y: 2199 };
const HOME_EXIT: Point = { x: 985, y: 2190 };
// On the lit window, aligned with its right-hand mullion, near the base.
const HOME_LABEL_ANCHOR: Point = { x: 650, y: 2150 };
const SOLAR_LABEL_ANCHOR: Point = { x: 1000, y: 1180 };
// Top surface of the battery unit itself — the box's peak sits at
// x≈2500, y≈1900 — not the inverter panel above it, so the leader line
// actually lands on the battery instead of stopping in empty wall space.
const BATTERY_LABEL_ANCHOR: Point = { x: 2500, y: 1900 };
// The EV charger's own real charging cable — a lit loop from the
// wall-mounted unit's underside, curving down and left to the car's
// charging port in the garage bay. More waypoints than the other wires'
// bends, since this one is a real continuous curve rather than a corner —
// a couple of straight segments cut visibly inside the arc.
const EV_CABLE_TOP: Point = { x: 3400, y: 2250 };
const EV_CABLE_BEND1: Point = { x: 3385, y: 2370 };
const EV_CABLE_BEND2: Point = { x: 3345, y: 2410 };
const EV_CABLE_BEND3: Point = { x: 3280, y: 2420 };
const EV_CABLE_END: Point = { x: 3240, y: 2400 };
// Top of the charger unit itself.
const EV_LABEL_ANCHOR: Point = { x: 3370, y: 1935 };
const TOP_LABEL_Y = 300;
const BOTTOM_LABEL_Y = 3600;

// Rounds a polyline's interior corners into smooth elbows — pull back
// `radius` along each adjacent segment, then join through the original
// vertex with a quadratic curve.
function roundedPath(points: Point[], radius = 60): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const distPrev = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const distNext = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, distPrev / 2, distNext / 2);
    const towardPrev = { x: (prev.x - cur.x) / (distPrev || 1), y: (prev.y - cur.y) / (distPrev || 1) };
    const towardNext = { x: (next.x - cur.x) / (distNext || 1), y: (next.y - cur.y) / (distNext || 1) };
    const p1 = { x: cur.x + towardPrev.x * r, y: cur.y + towardPrev.y * r };
    const p2 = { x: cur.x + towardNext.x * r, y: cur.y + towardNext.y * r };
    d += ` L ${p1.x} ${p1.y} Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

interface Conduit {
  key: string;
  d: string;
  color: string;
  active: boolean;
}

// power_package says which equipment a site actually has — a null value
// (not yet configured for an existing site) falls back to "don't hide
// anything," i.e. today's device-presence-only behavior. power_package's
// role is purely to additionally *hide* a wire that's known not to
// exist; a live, non-null reading is still required for a wire to show,
// exactly like the EV wire already worked before this.
function hasSolarPackage(pkg: string | null): boolean {
  return pkg === null || pkg.includes("solar");
}
function hasBatteryPackage(pkg: string | null): boolean {
  return pkg === null || pkg.includes("battery");
}
function hasEvPackage(pkg: string | null): boolean {
  return pkg === null || pkg.includes("_ev") || pkg === "ev_charger_only";
}
// power_source_category is a separate, orthogonal site field (how the
// site connects to the utility, not what equipment it has) — it only
// ever hides the Grid wire, and only for a genuinely off-grid site.
function hasGridSource(category: string | null): boolean {
  return category !== "off_grid";
}

export function EnergyFlowDiagram({
  solarW,
  batteryW,
  gridW,
  loadW,
  batterySocPct,
  evW = null,
  powerPackage = null,
  powerSourceCategory = null,
}: {
  solarW: number | null;
  /** positive = charging, negative = discharging */
  batteryW: number | null;
  /** positive = importing, negative = exporting */
  gridW: number | null;
  loadW: number | null;
  batterySocPct: number | null;
  /** The site's EV charger, if it has one — a separate device from
   *  whichever one this diagram's other readings come from, so it's
   *  optional and simply omitted (no wire, no label) when the site
   *  doesn't have a charger or that device hasn't reported yet. */
  evW?: number | null;
  /** The site's configured equipment combination (sites.power_package) —
   *  additionally hides a wire known not to exist for this site (e.g. no
   *  Battery wire for a plain solar_inverter site), on top of the
   *  existing live-reading check. */
  powerPackage?: string | null;
  /** The site's grid connection type (sites.power_source_category) —
   *  hides the Grid wire entirely for an off_grid site. */
  powerSourceCategory?: string | null;
}) {
  const showSolar = hasSolarPackage(powerPackage) && solarW !== null;
  const showBattery = hasBatteryPackage(powerPackage) && batteryW !== null;
  const showGrid = hasGridSource(powerSourceCategory) && gridW !== null;
  const showEv = hasEvPackage(powerPackage) && evW !== null;

  const solarActive = (solarW ?? 0) > 0;
  const batteryCharging = (batteryW ?? 0) > 0;
  const batteryDischarging = (batteryW ?? 0) < 0;
  const gridImporting = (gridW ?? 0) > 0;
  const gridExporting = (gridW ?? 0) < 0;
  const loadActive = (loadW ?? 0) > 0;
  const evActive = (evW ?? 0) > 0;

  const solarColor: FlowColorKey = solarActive ? "favorable" : "idle";
  const batteryColor: FlowColorKey = batteryCharging ? "favorable" : batteryDischarging ? "drawing" : "idle";
  const gridColor: FlowColorKey = gridExporting ? "favorable" : gridImporting ? "drawing" : "idle";
  // Load and EV charging only ever consume — there's no "direction" to
  // encode, so they get their own color rather than reusing
  // favorable/drawing, which both imply a direction choice that doesn't
  // apply here.
  const homeColor: FlowColorKey = loadActive ? "neutral" : "idle";
  const evColor: FlowColorKey = evActive ? "neutral" : "idle";

  const reverse = (pts: Point[]) => [...pts].reverse();

  const solarPath = [SOLAR_TOP, SOLAR_BEND, INVERTER_TOP];
  const batteryPathPoints = [BATTERY_JUNCTION, BATTERY_BEND, BATTERY_ENTRY];
  const batteryPath = batteryCharging ? batteryPathPoints : reverse(batteryPathPoints);
  const gridPathPoints = [INVERTER_BOTTOM, GRID_BEND, GRID_EXIT];
  const gridPath = gridExporting ? gridPathPoints : reverse(gridPathPoints);
  // Energy only ever flows one way here (inverter → home, charger → car),
  // so neither of these paths ever needs reversing the way battery/grid do.
  const homePath = [HOME_JUNCTION, HOME_BEND, HOME_EXIT];
  const evPath = [EV_CABLE_TOP, EV_CABLE_BEND1, EV_CABLE_BEND2, EV_CABLE_BEND3, EV_CABLE_END];

  const conduits: Conduit[] = [
    ...(showSolar ? [{ key: "solar", d: roundedPath(solarPath, 30), color: FLOW_COLOR[solarColor], active: solarActive }] : []),
    ...(showBattery
      ? [{ key: "battery", d: roundedPath(batteryPath, 40), color: FLOW_COLOR[batteryColor], active: batteryCharging || batteryDischarging }]
      : []),
    ...(showGrid ? [{ key: "grid", d: roundedPath(gridPath, 60), color: FLOW_COLOR[gridColor], active: gridImporting || gridExporting }] : []),
    { key: "home", d: roundedPath(homePath, 50), color: FLOW_COLOR[homeColor], active: loadActive },
    ...(showEv ? [{ key: "ev", d: roundedPath(evPath, 45), color: FLOW_COLOR[evColor], active: evActive }] : []),
  ];

  const batteryValue = `${fmtW(batteryW)} · ${batterySocPct !== null ? Math.round(batterySocPct) : "—"}%`;

  return (
    <div className="relative mx-auto w-full max-w-lg" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
      {/* The source photo is an opaque JPEG with its own flat, non-uniform
          light background (it has a vignette and a darker border near the
          edges, which ruled out a clean color-threshold or clip-path
          silhouette trace). This radial mask feathers its edges to
          transparent well inside the frame instead, so the flat backdrop
          dissolves into the dashboard's background — light or dark — rather
          than reading as a hard-edged box. */}
      <div
        className="absolute inset-0"
        style={{
          maskImage: "radial-gradient(ellipse at center, #fff 72%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, #fff 72%, transparent 100%)",
        }}
      >
        <Image src={IMAGE_SRC} alt={IMAGE_ALT} fill sizes="(min-width: 1024px) 32rem, 100vw" className="object-contain pointer-events-none select-none" priority />
      </div>

      {/* Same geometry rendered twice — only the leader-line and label
          colors differ — so the pointer/value colors switch with the
          dashboard's theme even though the underlying photo doesn't. */}
      <div className="absolute inset-0 dark:hidden">
        <FlowOverlay
          conduits={conduits}
          solarW={solarW}
          batteryValue={batteryValue}
          loadW={loadW}
          gridW={gridW}
          evW={evW}
          showSolar={showSolar}
          showBattery={showBattery}
          showGrid={showGrid}
          showEv={showEv}
          leaderColor="#000000"
          titleColor="#64748b"
          valueColor="#1e293b"
        />
      </div>
      <div className="absolute inset-0 hidden dark:block">
        <FlowOverlay
          conduits={conduits}
          solarW={solarW}
          batteryValue={batteryValue}
          loadW={loadW}
          gridW={gridW}
          evW={evW}
          showSolar={showSolar}
          showBattery={showBattery}
          showGrid={showGrid}
          showEv={showEv}
          leaderColor="#f8fafc"
          titleColor="#94a3b8"
          valueColor="#f8fafc"
        />
      </div>
    </div>
  );
}

function FlowOverlay({
  conduits,
  solarW,
  batteryValue,
  loadW,
  gridW,
  evW,
  showSolar,
  showBattery,
  showGrid,
  showEv,
  leaderColor,
  titleColor,
  valueColor,
}: {
  conduits: Conduit[];
  solarW: number | null;
  batteryValue: string;
  loadW: number | null;
  gridW: number | null;
  evW: number | null;
  showSolar: boolean;
  showBattery: boolean;
  showGrid: boolean;
  showEv: boolean;
  leaderColor: string;
  titleColor: string;
  valueColor: string;
}) {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <filter id="efd-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      {conduits.map((c) => (
        <path
          key={`${c.key}-glow`}
          d={c.d}
          fill="none"
          stroke={c.color}
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
          filter="url(#efd-glow)"
        />
      ))}
      {conduits.map((c) => (
        <path key={c.key} d={c.d} fill="none" stroke={c.color} strokeWidth="25" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {conduits
        .filter((c) => c.active)
        .map((c) => (
          <circle key={`${c.key}-dot`} r="16" fill="#ffffff">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={c.d} />
          </circle>
        ))}

      {showSolar && (
        <FlowLabel
          anchor={SOLAR_LABEL_ANCHOR}
          labelPos={{ x: SOLAR_LABEL_ANCHOR.x, y: TOP_LABEL_Y }}
          align="middle"
          title="Solar"
          value={fmtW(solarW)}
          leaderColor={leaderColor}
          titleColor={titleColor}
          valueColor={valueColor}
        />
      )}
      {showBattery && (
        <FlowLabel
          anchor={BATTERY_LABEL_ANCHOR}
          labelPos={{ x: BATTERY_LABEL_ANCHOR.x, y: TOP_LABEL_Y }}
          align="middle"
          title="Battery"
          value={batteryValue}
          leaderColor={leaderColor}
          titleColor={titleColor}
          valueColor={valueColor}
        />
      )}
      <FlowLabel
        anchor={HOME_LABEL_ANCHOR}
        labelPos={{ x: HOME_LABEL_ANCHOR.x, y: BOTTOM_LABEL_Y }}
        align="middle"
        title="Home"
        value={fmtW(loadW)}
        valueAbove
        leaderColor={leaderColor}
        titleColor={titleColor}
        valueColor={valueColor}
      />
      {showGrid && (
        <FlowLabel
          anchor={GRID_EXIT}
          labelPos={{ x: GRID_EXIT.x, y: BOTTOM_LABEL_Y }}
          align="middle"
          title="Grid"
          value={fmtW(gridW)}
          valueAbove
          leaderColor={leaderColor}
          titleColor={titleColor}
          valueColor={valueColor}
        />
      )}
      {/* Only when this site actually has an EV charger and its package
          says it's EV-equipped — see the "ev" conduit's own comment.
          Centered on the anchor like every other label —
          EV_LABEL_ANCHOR sits far enough from the frame's right edge
          (480px of margin at x=3370 of a 3850-wide canvas) that a
          centered title/value never clips. */}
      {showEv && (
        <FlowLabel
          anchor={EV_LABEL_ANCHOR}
          labelPos={{ x: EV_LABEL_ANCHOR.x, y: TOP_LABEL_Y }}
          align="middle"
          title="EV Charger"
          value={fmtW(evW)}
          leaderColor={leaderColor}
          titleColor={titleColor}
          valueColor={valueColor}
        />
      )}
    </svg>
  );
}

// Gap between the leader line's tip and the nearest edge of its text block,
// and the line-height between the title and value within that block — both
// generous so the text never crowds or overlaps the line.
const LABEL_GAP = 90;
const LABEL_STEP = 118;
const LABEL_TITLE_SIZE = 76;
const LABEL_VALUE_SIZE = 116;

function FlowLabel({
  anchor,
  labelPos,
  title,
  value,
  align,
  valueAbove = false,
  leaderColor,
  titleColor,
  valueColor,
}: {
  anchor: Point;
  labelPos: Point;
  title: string;
  value: string;
  align: "start" | "middle" | "end";
  valueAbove?: boolean;
  leaderColor: string;
  titleColor: string;
  valueColor: string;
}) {
  // Text always sits on the far side of the line's tip from the anchor —
  // above the tip when the label row is near the top of the frame (Solar,
  // Battery), below it when the row is near the bottom (Home, Grid) — so it
  // never spans across, and therefore never touches, the line itself.
  const valueY = valueAbove ? labelPos.y + LABEL_GAP + LABEL_VALUE_SIZE * 0.8 : labelPos.y - LABEL_GAP;
  const titleY = valueAbove ? valueY + LABEL_STEP : valueY - LABEL_STEP;
  return (
    <g>
      <line x1={anchor.x} y1={anchor.y} x2={labelPos.x} y2={labelPos.y} stroke={leaderColor} strokeWidth="5" />
      {valueAbove ? (
        <>
          <text x={labelPos.x} y={valueY} textAnchor={align} fontSize={LABEL_VALUE_SIZE} fontWeight="700" fill={valueColor}>
            {value}
          </text>
          <text x={labelPos.x} y={titleY} textAnchor={align} fontSize={LABEL_TITLE_SIZE} fill={titleColor}>
            {title}
          </text>
        </>
      ) : (
        <>
          <text x={labelPos.x} y={titleY} textAnchor={align} fontSize={LABEL_TITLE_SIZE} fill={titleColor}>
            {title}
          </text>
          <text x={labelPos.x} y={valueY} textAnchor={align} fontSize={LABEL_VALUE_SIZE} fontWeight="700" fill={valueColor}>
            {value}
          </text>
        </>
      )}
    </g>
  );
}
