import * as React from "react";
import { CAR_BODY, CAR_BODY_INNER, CAR_BODY_OUTER, CAR_WHEELS } from "@/components/sections/ev-car-art";
import { cn } from "@/lib/utils";

export type EvSceneState = "charging" | "idle" | "offline";

/** Where the drawing's pieces sit: the car's artwork (its own coordinates) is moved right to leave room for the wallbox, and down to
 *  stand on the ground line. */
const CAR_SHIFT = { x: 136, y: -78 };
const GROUND_Y = 313;
/** The charge port, on the car's tail (in drawing coordinates), and the wallbox's socket. */
const PORT = { x: 268, y: 158 };
const SOCKET = { x: 122, y: 206 };

/**
 * The charger's picture on the Overview: a wallbox, a cable and a car in side view, in the dashboard's own colours. While charging the
 * car and cable are green and energy runs down the cable; when the charger is offline everything is muted. The car is the user's own
 * artwork (sections/ev-car-art.ts), so a new drawing only has to replace that file's paths.
 */
export function EvCarScene({ state, plugged, className }: { state: EvSceneState; plugged: boolean; className?: string }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const charging = state === "charging";
  const offline = state === "offline";
  const tone = charging ? "text-emerald-600 dark:text-emerald-400" : offline ? "text-muted-foreground/60" : "text-foreground/80";
  const cable = `M${SOCKET.x} ${SOCKET.y} C 168 276, 226 262, 242 196 C 248 168, 256 ${PORT.y}, ${PORT.x} ${PORT.y}`;
  const hanging = `M${SOCKET.x} ${SOCKET.y} C 160 262, 150 286, 112 252`;

  return (
    <svg viewBox="0 0 1130 330" role="img" aria-label={charging ? "A car charging at the wallbox" : plugged ? "A car plugged in at the wallbox" : "A wallbox and a car"} className={cn("block w-full", tone, className)}>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity={charging ? 0.2 : 0.1} />
          <stop offset="1" stopColor="currentColor" stopOpacity={charging ? 0.06 : 0.02} />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.35" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-ground`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="currentColor" stopOpacity={charging ? 0.28 : 0.14} />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={CAR_BODY_OUTER} />
        </clipPath>
      </defs>

      {/* the ground: a faint line and the car's shadow */}
      <line x1="0" y1={GROUND_Y} x2="1130" y2={GROUND_Y} stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
      <ellipse cx="700" cy={GROUND_Y + 2} rx="470" ry="16" fill={`url(#${uid}-ground)`} />

      {/* the wallbox */}
      <g>
        <rect x="34" y="66" width="92" height="170" rx="18" className="fill-card stroke-border" strokeWidth="3" />
        <rect x="46" y="78" width="68" height="10" rx="5" fill="currentColor" fillOpacity="0.12" />
        <circle cx="80" cy="132" r="22" fill="none" stroke="currentColor" strokeOpacity={offline ? 0.25 : 0.9} strokeWidth="5" />
        <path d="M84 118 L72 134 H80 L76 146 L89 129 H81 Z" fill="currentColor" fillOpacity={offline ? 0.3 : 1} />
        {charging && <circle cx="80" cy="132" r="30" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" className="origin-center motion-safe:animate-pulse" />}
        <rect x="58" y="176" width="44" height="14" rx="7" fill="currentColor" fillOpacity="0.12" />
        {/* its socket, where the cable leaves */}
        <circle cx={SOCKET.x} cy={SOCKET.y} r="7" className="fill-card stroke-border" strokeWidth="3" />
      </g>

      {/* the cable: plugged into the car, or hanging at the wallbox while no car is connected */}
      <path d={plugged ? cable : hanging} fill="none" stroke="currentColor" strokeOpacity={offline ? 0.3 : 0.55} strokeWidth="9" strokeLinecap="round" className="stroke-foreground/30" />
      {charging && plugged && <path d={cable} pathLength={1} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray="0.025 0.1" className="motion-safe:animate-bolt-trace" />}
      {plugged && <circle cx={PORT.x} cy={PORT.y} r="7" fill="currentColor" />}

      {/* the car */}
      <g transform={`translate(${CAR_SHIFT.x} ${CAR_SHIFT.y})`}>
        <path d={CAR_BODY_OUTER} fill={`url(#${uid}-body)`} />
        {/* a soft shine that sweeps across the paint, kept inside the silhouette */}
        <g clipPath={`url(#${uid}-clip)`}>
          <rect x="200" y="110" width="760" height="250" fill={`url(#${uid}-shine)`} opacity="0.5" />
          {charging && <rect x="126" y="110" width="140" height="250" fill="currentColor" opacity="0.18" className="motion-safe:animate-pulse" />}
        </g>
        {/* the two wheels: dark tyre, rim and hub, inside their arches */}
        {[
          { cx: 280, cy: 329 },
          { cx: 795, cy: 328 },
        ].map((w) => (
          <g key={w.cx}>
            <circle cx={w.cx} cy={w.cy} r="62" fill="#0c1116" className="stroke-foreground/20" strokeWidth="2" />
            <circle cx={w.cx} cy={w.cy} r="40" fill="none" className="stroke-foreground/40" strokeWidth="4" />
            {[0, 72, 144, 216, 288].map((a) => (
              <line key={a} x1={w.cx} y1={w.cy} x2={w.cx} y2={w.cy - 38} className="stroke-foreground/25" strokeWidth="5" strokeLinecap="round" transform={`rotate(${a} ${w.cx} ${w.cy})`} />
            ))}
            <circle cx={w.cx} cy={w.cy} r="11" className="fill-foreground/45" />
          </g>
        ))}
        {/* the outlines (the artwork: body, then the wheel arches) */}
        <path d={CAR_BODY} fillRule="evenodd" fill="currentColor" />
        <path d={CAR_BODY_INNER} fill="none" stroke="currentColor" strokeOpacity="0.0" />
        {CAR_WHEELS.map((d) => (
          <path key={d} d={d} fillRule="evenodd" fill="currentColor" fillOpacity="0.9" />
        ))}
      </g>
    </svg>
  );
}
