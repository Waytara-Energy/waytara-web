"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PARTNER_TYPE_LABEL } from "@/lib/partner-network";
import { partnersCovering, type ListedPartner } from "@/lib/partner-directory";
import { TN_BOUNDS, TN_DISTRICTS, TN_MARKERS, TN_SIZE, type TnRegion } from "@/lib/tn-map";
import { cn } from "@/lib/utils";

// The four regions Tamil Nadu is commonly divided into (plain names everyone knows), each with its own tint (the same green family as the rest of the site).
const REGIONS: { id: TnRegion; name: string; short: string; fill: string; dot: string }[] = [
  { id: "north", name: "North Tamil Nadu", short: "North", fill: "fill-emerald-200 dark:fill-emerald-800", dot: "bg-emerald-300 dark:bg-emerald-700" },
  { id: "west", name: "West Tamil Nadu", short: "West", fill: "fill-emerald-500 dark:fill-emerald-600", dot: "bg-emerald-500 dark:bg-emerald-500" },
  { id: "centre", name: "Central Tamil Nadu", short: "Central", fill: "fill-teal-300 dark:fill-teal-700", dot: "bg-teal-300 dark:bg-teal-700" },
  { id: "south", name: "South Tamil Nadu", short: "South", fill: "fill-lime-300 dark:fill-lime-700", dot: "bg-lime-300 dark:bg-lime-700" },
];
const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<TnRegion, (typeof REGIONS)[number]>;

// Every district of a region by name (the marker-only district included), in alphabetical order.
const NAMES_OF: Record<TnRegion, string[]> = Object.fromEntries(
  REGIONS.map((r) => [r.id, [...TN_DISTRICTS.filter((d) => d.region === r.id).map((d) => d.name), ...TN_MARKERS.filter((m) => m.region === r.id).map((m) => m.name)].sort()]),
) as Record<TnRegion, string[]>;

type Box = { x: number; y: number; w: number; h: number };
const ASPECT = TN_SIZE.width / TN_SIZE.height;
const WHOLE: Box = { x: 0, y: 0, w: TN_SIZE.width, h: TN_SIZE.height };

/** The part of the map to show: the whole state, or a region with a margin, widened to the map's own proportions so nothing jumps. */
function boxFor(region: TnRegion | null): Box {
  if (!region) return WHOLE;
  const b = TN_BOUNDS[region];
  let w = b.w + 28;
  let h = b.h + 28;
  if (w / h > ASPECT) h = w / ASPECT;
  else w = h * ASPECT;
  return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
}

const APPLY_LINKS = [
  { id: "contractor", label: "Apply as a contractor" },
  { id: "solar", label: "Apply as a solar team" },
  { id: "ev", label: "Apply as an EV charging team" },
  { id: "technician", label: "Apply as a technician" },
];

/** Who is listed in the chosen district or region: the partners, or an invitation to be the first, with a quick link to apply as each kind. */
function Presence({ partners, scope, label }: { partners: ListedPartner[]; scope: readonly string[]; label: string }) {
  const found = partnersCovering(partners, scope);
  return (
    <div className="mt-6 rounded-2xl bg-theme-surface p-5">
      {found.length === 0 ? (
        <>
          <p className="text-base font-bold text-theme-primary">Be WayTara&apos;s first partner in {label}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-theme-secondary">No partner is listed here yet. Join early and grow your energy business with us.</p>
        </>
      ) : (
        <>
          <p className="text-base font-bold text-theme-primary">Our authorised partners in {label}</p>
          <ul className="mt-3 divide-y divide-theme-border">
            {found.map((p) => (
              <li key={`${p.name}-${p.type}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <span className="font-semibold text-theme-primary">{p.name}</span>
                <span className="text-sm text-theme-muted">{PARTNER_TYPE_LABEL[p.type]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-theme-secondary">Become one of them.</p>
        </>
      )}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {APPLY_LINKS.map((l) => (
          <li key={l.id}>
            <a href={`#apply-${l.id}`} className="inline-flex min-h-8 items-center text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
              {l.label} →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const pill = (on: boolean) =>
  cn(
    "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
    on ? "border-emerald-600 bg-emerald-600 text-white" : "border-theme-border text-theme-secondary hover:bg-theme-surface",
  );

/**
 * Tamil Nadu in its four regions, for phones first: pick a region (or tap it on the map) and the map zooms to it and names its districts, which are
 * also listed as chips to tap. Every district is on the map and in the lists. A drawing for orientation; partners from every district are welcome.
 */
export function PartnerMap({ partners = [] }: { partners?: ListedPartner[] }) {
  const [region, setRegion] = useState<TnRegion | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [box, setBox] = useState<Box>(WHOLE);
  const [px, setPx] = useState(360);
  const boxRef = useRef(box);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current = box;
  }, [box]);

  // Glide the map to the chosen region (straight there for anyone who prefers less motion).
  useEffect(() => {
    const from = boxRef.current;
    const to = boxFor(region);
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 550;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = ms ? Math.min(1, (t - t0) / ms) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      setBox({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [region]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPx(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pick = (r: TnRegion | null, d: string | null = null) => {
    setRegion(r);
    setDistrict(d);
  };
  // Names are kept to a readable size on screen whatever the zoom; the whole state shows no names on a phone, where the lists carry them.
  const fontUnits = (10.5 * box.w) / px;
  const showNames = region !== null || px >= 520;
  const shown = (r: TnRegion) => region === null || region === r;
  const districts = useMemo(() => [...TN_DISTRICTS].sort((a, b) => Number(a.name === district) - Number(b.name === district)), [district]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a region">
        <button type="button" aria-pressed={region === null} aria-label="All Tamil Nadu" onClick={() => pick(null)} className={pill(region === null)}>
          All
        </button>
        {REGIONS.map((r) => (
          <button key={r.id} type="button" aria-pressed={region === r.id} onClick={() => pick(region === r.id ? null : r.id)} aria-label={r.name} className={pill(region === r.id)}>
            {r.short}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-20">
        <div ref={wrap} className="mx-auto w-full max-w-md lg:max-w-xl" style={{ aspectRatio: `${TN_SIZE.width} / ${TN_SIZE.height}` }}>
          <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label="Map of Tamil Nadu in four regions, with every district" className="h-full w-full overflow-hidden">
            {districts.map((d) => (
              <path
                key={d.name}
                d={d.d}
                onClick={() => pick(d.region, district === d.name ? null : d.name)}
                className={cn(
                  "cursor-pointer stroke-white transition-opacity duration-300 dark:stroke-neutral-950",
                  REGION[d.region].fill,
                  d.name === district ? "stroke-emerald-900 stroke-[1.8] dark:stroke-emerald-100" : "stroke-[0.8]",
                  shown(d.region) ? "opacity-100" : "opacity-20",
                )}
              />
            ))}
            {showNames && (
              <g aria-hidden="true" className="pointer-events-none">
                {TN_DISTRICTS.filter((d) => shown(d.region)).map((d) => (
                  <text
                    key={d.name}
                    x={d.lx}
                    y={d.ly}
                    textAnchor="middle"
                    fontSize={fontUnits}
                    className={cn("fill-neutral-800 stroke-white/80 [paint-order:stroke] dark:fill-neutral-100 dark:stroke-neutral-950/80", d.name === district ? "font-bold" : "font-medium")}
                    strokeWidth={fontUnits * 0.22}
                  >
                    {d.name}
                  </text>
                ))}
                {TN_MARKERS.filter((m) => shown(m.region)).map((m) => (
                  <g key={m.name}>
                    <circle cx={m.x} cy={m.y} r={fontUnits * 0.18} className="fill-neutral-800 dark:fill-neutral-100" />
                    <text x={m.x + fontUnits * 0.4} y={m.y + fontUnits * 0.9} fontSize={fontUnits} className="fill-neutral-800 font-medium dark:fill-neutral-100">
                      {m.name}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </svg>
        </div>

        <div>
          {region === null ? (
            <ul className="space-y-8">
              {REGIONS.map((r) => (
                <li key={r.id} className="border-t border-theme-border pt-5">
                  <button type="button" onClick={() => pick(r.id)} className="flex w-full items-center gap-3 text-left">
                    <span className={cn("size-3 shrink-0 rounded-full", r.dot)} aria-hidden="true" />
                    <span className="text-lg font-bold tracking-tight text-theme-primary">{r.name}</span>
                    <span className="text-sm text-theme-muted">{NAMES_OF[r.id].length} districts</span>
                  </button>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {NAMES_OF[r.id].map((n) => (
                      <li key={n}>
                        <button type="button" onClick={() => pick(r.id, n)} className="inline-flex min-h-9 items-center rounded-full bg-theme-surface px-3.5 text-sm text-theme-secondary transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-950">
                          {n}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-theme-border pt-5">
              <div className="flex items-center gap-3">
                <span className={cn("size-3 shrink-0 rounded-full", REGION[region].dot)} aria-hidden="true" />
                <h3 className="text-[clamp(1.4rem,2.2vw,1.9rem)] font-bold tracking-tight text-theme-primary">{REGION[region].name}</h3>
              </div>
              <p className="mt-1 text-sm text-theme-muted">{NAMES_OF[region].length} districts</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {NAMES_OF[region].map((n) => (
                  <li key={n}>
                    <button
                      type="button"
                      aria-pressed={district === n}
                      onClick={() => setDistrict(district === n ? null : n)}
                      className={cn(
                        "inline-flex min-h-10 items-center rounded-full px-4 text-sm transition-colors",
                        district === n ? "bg-emerald-600 font-semibold text-white" : "bg-theme-surface text-theme-secondary hover:bg-emerald-100 dark:hover:bg-emerald-950",
                      )}
                    >
                      {n}
                    </button>
                  </li>
                ))}
              </ul>
              <p aria-live="polite" className="mt-5 text-[15px] leading-relaxed text-theme-secondary">
                {district ? `${district}: partners from here are welcome.` : "Tap a district to see it on the map."}
              </p>
              <Presence partners={partners} scope={district ? [district] : NAMES_OF[region]} label={district ?? REGION[region].name} />
              <button type="button" onClick={() => pick(null)} className="mt-5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                Show all Tamil Nadu
              </button>
            </div>
          )}
          <p className="mt-8 border-t border-theme-border pt-5 text-sm leading-relaxed text-theme-muted">
            Partners from every district are welcome. You choose your own district when you apply.
          </p>
        </div>
      </div>
    </div>
  );
}
