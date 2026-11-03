import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

interface Part {
  src: string;
  /** the drawing's own proportions (its cropped viewBox), so it is never squashed */
  w: number;
  h: number;
  alt: string;
  /** SVGs are served as they are; the charger is a raster */
  svg: boolean;
  /** what this part is doing, as a small badge on its drawing (words only, no figures) */
  status: string;
  title: string;
  body: string;
}

// The four parts, in the order the energy travels: generate, convert, store, use.
const PARTS: Part[] = [
  {
    src: "/images/approach/solar-panel.svg",
    w: 346,
    h: 698,
    alt: "A solar panel",
    svg: true,
    status: "Generating",
    title: "Solar panels",
    body: "Rooftop panels turn sunlight into clean power for your property.",
  },
  {
    src: "/images/approach/solar-inverter.svg",
    w: 376,
    h: 583,
    alt: "A solar inverter",
    svg: true,
    status: "Converting",
    title: "Inverter",
    body: "Turns that power into electricity your property can use, and keeps every part in step.",
  },
  {
    src: "/images/approach/solar-battery.svg",
    w: 362,
    h: 515,
    alt: "A home battery",
    svg: true,
    status: "Backup ready",
    title: "Battery storage",
    body: "Keeps spare solar for the evening, and for when the grid goes down.",
  },
  {
    src: "/images/approach/ev-charger.webp",
    w: 615,
    h: 987,
    alt: "An EV charger",
    svg: false,
    status: "Charging from solar",
    title: "EV charging",
    body: "Charges your vehicle from your own solar and battery, when it suits you.",
  },
];

/**
 * The four parts as four feature cards: a lit stage with the drawing and a status badge, the title and a line of info beneath.
 * Small connectors with a travelling pulse join the cards, so the row still reads as one system.
 */
export function ApproachParts() {
  return (
    <div>
      <Reveal direction="up" duration={800} distance={20}>
        <div className="mb-10 flex flex-col gap-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">One integrated system</p>
            <h3 className="mt-3 text-3xl font-bold tracking-tight text-theme-primary sm:text-4xl">Four parts, working as one.</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-theme-secondary sm:text-base">
              Every part talks to the others, so your power goes where it is needed.
            </p>
          </div>
          <Link
            href="/solutions"
            className="group/cta inline-flex h-11 w-fit shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Plan my system
            <ArrowRight className="size-4 transition-transform group-hover/cta:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </Reveal>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {PARTS.map((part, i) => (
          <li key={part.src} className="relative">
            <Reveal direction="up" duration={800} delay={i * 120} distance={28} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-theme-border bg-theme-surface transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_24px_40px_-24px_rgba(16,185,129,0.35)]">
                {/* the stage: a lit circle of rings behind the drawing, and what it is doing as a badge */}
                <div className="relative flex h-64 flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-emerald-500/[0.07] to-transparent px-4 pb-4 pt-6">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_50%_46%,black_15%,transparent_68%)]">
                    <span className="absolute left-1/2 top-[46%] size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/30" />
                    <span className="absolute left-1/2 top-[46%] size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/20" />
                    <span className="absolute left-1/2 top-[46%] size-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/10" />
                  </div>
                  <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[46%] size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100 dark:bg-emerald-500/15" />

                  <div className="relative flex flex-1 items-center">
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-2 left-1/2 h-2.5 w-3/4 -translate-x-1/2 rounded-full bg-black/15 blur-md dark:bg-black/60" />
                    <Image
                      src={part.src}
                      alt={part.alt}
                      width={part.w}
                      height={part.h}
                      unoptimized={part.svg}
                      sizes="(min-width: 1024px) 160px, 40vw"
                      className="relative h-40 w-auto drop-shadow-[0_12px_16px_rgba(0,0,0,0.16)] transition-transform duration-500 ease-out group-hover:scale-105 dark:drop-shadow-[0_12px_16px_rgba(0,0,0,0.5)]"
                    />
                  </div>

                  <span className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface/90 px-3 py-1 text-xs font-medium text-theme-primary shadow-sm backdrop-blur">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                    </span>
                    {part.status}
                  </span>
                </div>

                <div className="flex flex-1 flex-col px-6 pb-7 pt-5">
                  <h4 className="text-lg font-bold tracking-tight text-theme-primary">{part.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-theme-secondary">{part.body}</p>
                </div>
              </article>
            </Reveal>

            {/* the link to the next card: a line with a pulse of energy crossing it, at the height of the drawings */}
            {i < PARTS.length - 1 && (
              <span aria-hidden="true" className="absolute -right-[2.2rem] top-[7.6rem] z-10 hidden w-[2.4rem] -translate-y-1/2 items-center lg:flex">
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="relative h-px flex-1 overflow-hidden bg-emerald-500/30">
                  <span className="absolute inset-y-0 left-0 w-1/3 animate-energy-flow bg-gradient-to-r from-transparent via-emerald-500 to-transparent motion-reduce:hidden" style={{ animationDelay: `${i * 0.8}s` }} />
                </span>
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
