import * as React from "react";

// Small isometric drawings for the "Our Approach" cards, drawn as SVG in the site's own colours (emerald and slate, with a
// little amber for the sun), so they follow the light and dark theme. Everything is built from boxes (cuboids) on a diamond
// platform. A box is three faces (top, left, right); each face is its own flat drawing area, so details (screens, bars,
// wheels) are drawn in plain 2D and the face's transform lays them onto the box.

const COS = 0.8660254;
const SIN = 0.5;
const OX = 150;
const OY = 62;
const PLATFORM = 136;

const proj = (x: number, y: number, z: number): [number, number] => [OX + (x - y) * COS, OY + (x + y) * SIN - z];

type Tone = "green" | "neutral" | "accent" | "glass" | "panel";

const TONES: Record<Tone, { top: string; left: string; right: string; line: string }> = {
  green: { top: "fill-emerald-50 dark:fill-emerald-950", left: "fill-emerald-100 dark:fill-emerald-900", right: "fill-emerald-200 dark:fill-emerald-800", line: "stroke-emerald-600/60 dark:stroke-emerald-400/50" },
  neutral: { top: "fill-white dark:fill-slate-700", left: "fill-slate-100 dark:fill-slate-800", right: "fill-slate-200 dark:fill-slate-900", line: "stroke-slate-400/70 dark:stroke-slate-500/60" },
  accent: { top: "fill-emerald-400", left: "fill-emerald-500", right: "fill-emerald-600", line: "stroke-emerald-700/40" },
  glass: { top: "fill-sky-100 dark:fill-sky-900", left: "fill-sky-200 dark:fill-sky-800", right: "fill-sky-300 dark:fill-sky-700", line: "stroke-sky-500/50" },
  panel: { top: "fill-blue-900 dark:fill-blue-950", left: "fill-slate-300 dark:fill-slate-600", right: "fill-slate-400 dark:fill-slate-700", line: "stroke-slate-500/60" },
};

interface CuboidProps {
  x: number;
  y: number;
  z: number;
  /** size along x, along y and up */
  w: number;
  d: number;
  h: number;
  tone?: Tone;
  /** drawings laid on each face, in that face's own flat units: top is w x d, left is w x h, right is d x h */
  top?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

function Cuboid({ x, y, z, w, d, h, tone = "green", top, left, right }: CuboidProps) {
  const t = TONES[tone];
  const [et, ft] = proj(x, y, z + h);
  const [el, fl] = proj(x, y + d, z);
  const [er, fr] = proj(x + w, y, z);
  const stroke = { strokeWidth: 1, strokeLinejoin: "round" as const, vectorEffect: "non-scaling-stroke" as const };
  return (
    <g className={t.line}>
      <g transform={`matrix(${COS} ${SIN} ${-COS} ${SIN} ${et} ${ft})`}>
        <rect width={w} height={d} className={t.top} {...stroke} />
        {top}
      </g>
      <g transform={`matrix(${COS} ${SIN} 0 -1 ${el} ${fl})`}>
        <rect width={w} height={h} className={t.left} {...stroke} />
        {left}
      </g>
      <g transform={`matrix(${-COS} ${SIN} 0 -1 ${er} ${fr})`}>
        <rect width={d} height={h} className={t.right} {...stroke} />
        {right}
      </g>
    </g>
  );
}

/** The diamond the objects stand on: a dashed outline with a second, inner one. */
function Platform() {
  const outer = [proj(0, 0, 0), proj(PLATFORM, 0, 0), proj(PLATFORM, PLATFORM, 0), proj(0, PLATFORM, 0)];
  const inset = 14;
  const inner = [proj(inset, inset, 0), proj(PLATFORM - inset, inset, 0), proj(PLATFORM - inset, PLATFORM - inset, 0), proj(inset, PLATFORM - inset, 0)];
  const pts = (a: [number, number][]) => a.map((p) => p.join(",")).join(" ");
  return (
    <g strokeLinejoin="round" fill="none">
      <polygon points={pts(outer)} className="fill-emerald-500/[0.06] stroke-emerald-500/45" strokeWidth={1.2} strokeDasharray="5 5" />
      <polygon points={pts(inner)} className="stroke-emerald-500/25" strokeWidth={1} />
    </g>
  );
}

/** A flat shape on the ground, in ground units (x along the platform's right edge, y along its left edge). */
function Ground({ children }: { children: React.ReactNode }) {
  const [e, f] = proj(0, 0, 0);
  return <g transform={`matrix(${COS} ${SIN} ${-COS} ${SIN} ${e} ${f})`}>{children}</g>;
}

const line = { vectorEffect: "non-scaling-stroke" as const, fill: "none" };

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 300 230" role="img" aria-label={label} className="h-auto w-full overflow-visible">
      <Platform />
      {children}
    </svg>
  );
}

/** Rooftop solar panels joined to an inverter, with the sun above. */
export function SolarIllustration() {
  const cells = <path d="M10 0V26M20 0V26M0 13H30" className="stroke-sky-300/60" strokeWidth={0.7} {...line} />;
  const panel = (x: number, y: number) => <Cuboid key={`${x}-${y}`} x={x} y={y} z={10} w={30} d={26} h={3} tone="panel" top={cells} />;
  return (
    <Frame label="Solar panels connected to an inverter">
      {/* the sun */}
      <g className="stroke-amber-400" strokeWidth={2} strokeLinecap="round" fill="none">
        <circle cx={238} cy={38} r={11} className="fill-amber-300 stroke-amber-400" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d={`M${238 + Math.cos((a * Math.PI) / 180) * 17} ${38 + Math.sin((a * Math.PI) / 180) * 17}L${238 + Math.cos((a * Math.PI) / 180) * 22} ${38 + Math.sin((a * Math.PI) / 180) * 22}`} />
        ))}
      </g>
      {/* posts under the panels */}
      <Cuboid x={26} y={24} z={0} w={4} d={4} h={10} tone="neutral" />
      <Cuboid x={26} y={74} z={0} w={4} d={4} h={10} tone="neutral" />
      <Cuboid x={60} y={24} z={0} w={4} d={4} h={10} tone="neutral" />
      <Cuboid x={60} y={74} z={0} w={4} d={4} h={10} tone="neutral" />
      {/* the panels: two columns of three */}
      {[14, 44, 74].flatMap((y) => [panel(14, y), panel(48, y)])}
      {/* the cable from the panels to the inverter */}
      <Ground>
        <path d="M62 100V108H98" className="stroke-emerald-500" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" {...line} />
      </Ground>
      {/* the inverter */}
      <Cuboid
        x={98}
        y={96}
        z={0}
        w={22}
        d={16}
        h={36}
        tone="neutral"
        top={<circle cx={11} cy={8} r={2.6} className="fill-emerald-500 stroke-none motion-safe:animate-pulse" />}
        left={
          <>
            <rect x={4} y={18} width={14} height={9} rx={1.5} className="fill-emerald-500 stroke-none" />
            <path d="M4 9H18M4 13H14" className="stroke-slate-400" strokeWidth={0.8} {...line} />
          </>
        }
        right={<path d="M4 8H12M4 12H12M4 16H12M4 20H12" className="stroke-slate-400" strokeWidth={0.8} {...line} />}
      />
    </Frame>
  );
}

/** A battery pack with charge bars and a small second module. */
export function BatteryIllustration() {
  const bolt = <path d="M33 2 24 14h7l-3 10 11-14h-7z" className="fill-emerald-500 stroke-none" />;
  return (
    <Frame label="A home battery pack">
      <Cuboid
        x={30}
        y={34}
        z={0}
        w={64}
        d={42}
        h={60}
        tone="green"
        top={
          <>
            <circle cx={14} cy={14} r={3.5} className="fill-none stroke-emerald-500/60" strokeWidth={1} {...line} />
            <circle cx={50} cy={14} r={3.5} className="fill-none stroke-emerald-500/60" strokeWidth={1} {...line} />
            <circle cx={14} cy={30} r={3.5} className="fill-none stroke-emerald-500/60" strokeWidth={1} {...line} />
            <circle cx={50} cy={30} r={3.5} className="fill-none stroke-emerald-500/60" strokeWidth={1} {...line} />
          </>
        }
        left={
          <>
            <path d="M16 6V54M32 6V54M48 6V54" className="stroke-emerald-500/30" strokeWidth={0.8} {...line} />
            <g transform="translate(6 12) scale(1.15)">{bolt}</g>
            <rect x={44} y={10} width={14} height={5} rx={2} className="fill-emerald-500/70 stroke-none" />
          </>
        }
        right={
          <>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <rect x={6} y={8 + i * 12} width={30} height={7} rx={2.5} className="fill-white stroke-emerald-500/40 dark:fill-slate-900" strokeWidth={0.8} {...line} />
                <rect x={7} y={9 + i * 12} width={i === 0 ? 12 : 28} height={5} rx={2} className="fill-emerald-500 stroke-none" />
              </g>
            ))}
          </>
        }
      />
      <Cuboid
        x={100}
        y={52}
        z={0}
        w={24}
        d={28}
        h={34}
        tone="neutral"
        left={<rect x={5} y={22} width={14} height={4} rx={2} className="fill-emerald-500 stroke-none" />}
        right={<path d="M6 8H22M6 12H22M6 16H22" className="stroke-slate-400" strokeWidth={0.8} {...line} />}
      />
      <Ground>
        <path d="M74 80V104H108" className="stroke-emerald-500/70" strokeWidth={1.6} strokeDasharray="4 4" strokeLinecap="round" {...line} />
      </Ground>
    </Frame>
  );
}

/** A wall-standing charger with a cable to a car. */
export function EvIllustration() {
  const wheel = (u: number) => (
    <g key={u}>
      <circle cx={u} cy={0} r={6.5} className="fill-slate-800 stroke-slate-950/40 dark:fill-slate-950" />
      <circle cx={u} cy={0} r={2.6} className="fill-slate-300 stroke-none" />
    </g>
  );
  return (
    <Frame label="An EV charger and a car">
      {/* the car */}
      <Cuboid x={52} y={44} z={7} w={64} d={34} h={14} tone="accent" left={<>{wheel(12)}{wheel(52)}</>} />
      <Cuboid x={64} y={50} z={21} w={34} d={22} h={12} tone="glass" />
      {/* the charger */}
      <Cuboid
        x={14}
        y={82}
        z={0}
        w={14}
        d={12}
        h={56}
        tone="neutral"
        top={<circle cx={7} cy={6} r={2.4} className="fill-emerald-500 stroke-none motion-safe:animate-pulse" />}
        right={
          <>
            <rect x={2.5} y={28} width={7} height={13} rx={1.5} className="fill-emerald-500 stroke-none" />
            <path d="M3 22H9" className="stroke-slate-400" strokeWidth={0.8} {...line} />
          </>
        }
        left={<path d="M8 40 4 47h4l-1 6 5-8H8z" className="fill-amber-400 stroke-none" />}
      />
      {/* the cable */}
      <path d={`M${proj(28, 88, 30).join(" ")} C ${proj(40, 100, 6).join(" ")} ${proj(46, 86, 6).join(" ")} ${proj(55, 78, 14).join(" ")}`} className="stroke-emerald-500" strokeWidth={2.4} strokeLinecap="round" {...line} />
      <circle cx={proj(55, 78, 14)[0]} cy={proj(55, 78, 14)[1]} r={2.6} className="fill-emerald-500 stroke-none" />
    </Frame>
  );
}

/** A monitoring screen with a chart, and a small card with a ring. */
export function DashboardIllustration() {
  return (
    <Frame label="An energy dashboard on a screen">
      {/* stand */}
      <Cuboid x={56} y={52} z={0} w={10} d={22} h={14} tone="neutral" />
      {/* the screen */}
      <Cuboid
        x={54}
        y={20}
        z={14}
        w={5}
        d={86}
        h={62}
        tone="neutral"
        right={
          <>
            <rect x={4} y={4} width={78} height={54} rx={3} className="fill-emerald-50 stroke-emerald-500/30 dark:fill-slate-950" strokeWidth={0.8} {...line} />
            <rect x={9} y={8} width={26} height={5} rx={2} className="fill-emerald-500 stroke-none" />
            <rect x={60} y={8} width={16} height={5} rx={2} className="fill-emerald-500/30 stroke-none" />
            <path d="M9 38 21 30 33 34 46 22 58 28 72 16V48H9z" className="fill-emerald-500/20 stroke-none" />
            <path d="M9 38 21 30 33 34 46 22 58 28 72 16" className="stroke-emerald-500" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...line} />
            {[14, 26, 38, 50, 62].map((u, i) => (
              <rect key={u} x={u} y={46 - [6, 10, 7, 12, 9][i]} width={6} height={[6, 10, 7, 12, 9][i]} rx={1} className="fill-amber-400/80 stroke-none" />
            ))}
          </>
        }
      />
      {/* a floating card with a ring */}
      <Cuboid
        x={96}
        y={84}
        z={4}
        w={4}
        d={36}
        h={34}
        tone="green"
        right={
          <>
            <circle cx={12} cy={17} r={8} className="stroke-emerald-500/25" strokeWidth={3.5} {...line} />
            <path d="M12 9A8 8 0 1 1 5 21" className="stroke-emerald-500" strokeWidth={3.5} strokeLinecap="round" {...line} />
            <path d="M25 11H32M25 17H32M25 23H30" className="stroke-emerald-500/60" strokeWidth={1.4} strokeLinecap="round" {...line} />
          </>
        }
      />
    </Frame>
  );
}
