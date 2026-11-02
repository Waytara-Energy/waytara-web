import Image from "next/image";
import { Activity } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

interface Part {
  src: string;
  /** the drawing's own proportions (its cropped viewBox), so it is never squashed */
  w: number;
  h: number;
  alt: string;
  /** SVGs are served as they are; the charger is a raster */
  svg: boolean;
  role: string;
  title: string;
  body: string;
}

// The four parts of the system, in the order the energy travels: generate, convert, store, use.
const PARTS: Part[] = [
  {
    src: "/images/approach/solar-panel.svg",
    w: 346,
    h: 698,
    alt: "A solar panel",
    svg: true,
    role: "Generate",
    title: "Solar panels",
    body: "Rooftop panels turn sunlight into clean power for your property.",
  },
  {
    src: "/images/approach/solar-inverter.svg",
    w: 376,
    h: 583,
    alt: "A solar inverter",
    svg: true,
    role: "Convert",
    title: "Inverter",
    body: "Turns that power into electricity your property can use, and keeps every part in step.",
  },
  {
    src: "/images/approach/solar-battery.svg",
    w: 362,
    h: 515,
    alt: "A home battery",
    svg: true,
    role: "Store",
    title: "Battery storage",
    body: "Keeps spare solar for the evening, and for when the grid goes down.",
  },
  {
    src: "/images/approach/ev-charger.webp",
    w: 615,
    h: 987,
    alt: "An EV charger",
    svg: false,
    role: "Use",
    title: "EV charging",
    body: "Charges your vehicle from your own solar and battery, when it suits you.",
  },
];

/**
 * The four parts as one system: equal columns, each drawing standing on the same floor, a rail of energy running through them,
 * and a line underneath that says they are managed together.
 */
export function ApproachParts() {
  return (
    <Reveal direction="up" duration={800} distance={28}>
      <div className="relative overflow-hidden rounded-[1.75rem] border border-theme-border bg-theme-surface shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_30px_60px_-30px_rgba(16,24,40,0.18)] dark:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
        {/* a faint wash of green from the top, so the card is lit rather than flat */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(16,185,129,0.12),transparent)]" />

        <div className="relative flex flex-col items-center gap-3 px-6 pt-7 text-center sm:flex-row sm:justify-between sm:px-10 sm:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            One integrated system
          </span>
          <p className="max-w-xl text-sm text-theme-secondary">Every part works with the others, so your power goes where it is needed.</p>
        </div>

        <ul className="relative grid grid-cols-2 lg:grid-cols-4">
          {PARTS.map((part, i) => (
            <li key={part.src} className={cn("group relative flex", i > 0 && "lg:border-l lg:border-theme-border", i % 2 === 1 && "border-l border-theme-border lg:border-l", i >= 2 && "border-t border-theme-border lg:border-t-0")}>
              <Reveal direction="up" duration={800} delay={i * 120} distance={28} className="flex w-full flex-col items-center px-4 pb-9 pt-8 text-center sm:px-6">
                {/* the stage: every drawing stands on the same floor */}
                <div className="relative flex h-48 w-full items-end justify-center sm:h-60 lg:h-72">
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-6 left-1/2 h-3/5 w-3/5 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-500 group-hover:bg-emerald-500/20" />
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-3 w-3/5 -translate-x-1/2 rounded-full bg-black/15 blur-md dark:bg-black/60" />
                  <Image
                    src={part.src}
                    alt={part.alt}
                    width={part.w}
                    height={part.h}
                    unoptimized={part.svg}
                    sizes="(min-width: 1024px) 220px, 30vw"
                    className="relative mb-3 h-40 w-auto max-w-full object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.16)] transition-transform duration-500 ease-out group-hover:-translate-y-2 sm:h-52 lg:h-60 dark:drop-shadow-[0_14px_20px_rgba(0,0,0,0.5)]"
                  />
                </div>

                {/* the rail: one line through all four parts, with a pulse of energy crossing each stretch of it */}
                <div aria-hidden="true" className="relative -mx-4 mt-6 flex h-4 w-[calc(100%+2rem)] items-center justify-center sm:-mx-6 sm:w-[calc(100%+3rem)]">
                  <span className={cn("absolute inset-y-[7px] hidden h-0.5 overflow-hidden rounded-full bg-emerald-500/20 lg:block", i === 0 ? "left-1/2 right-0" : i === PARTS.length - 1 ? "left-0 right-1/2" : "inset-x-0")}>
                    <span className="absolute inset-y-0 left-0 w-1/4 animate-energy-flow rounded-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent motion-reduce:hidden" style={{ animationDelay: `${i * 0.8}s` }} />
                  </span>
                  <span className="relative size-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 transition-[box-shadow] duration-300 group-hover:ring-8" />
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                  {String(i + 1).padStart(2, "0")} · {part.role}
                </p>
                <h3 className="mt-2 text-lg font-bold tracking-tight text-theme-primary sm:text-xl">{part.title}</h3>
                <p className="mt-2 max-w-[17rem] text-sm leading-relaxed text-theme-secondary">{part.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="relative flex flex-col items-center justify-center gap-2 border-t border-theme-border bg-theme-surface-muted/60 px-6 py-4 text-center sm:flex-row sm:gap-3">
          <Activity className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium text-theme-primary">
            Designed, installed and managed together <span className="font-normal text-theme-secondary">&mdash; one dashboard for all four.</span>
          </p>
        </div>
      </div>
    </Reveal>
  );
}
