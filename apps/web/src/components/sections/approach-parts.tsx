import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";

interface Part {
  src: string;
  /** the drawing's own proportions (its cropped viewBox), so it is never squashed */
  w: number;
  h: number;
  alt: string;
  kicker: string;
  title: string;
  body: string;
}

// The equipment, one row each: the drawing on the left and what it does on the right. No cards.
const PARTS: Part[] = [
  {
    src: "/images/approach/solar-panel.svg",
    w: 346,
    h: 698,
    alt: "A solar panel",
    kicker: "01 · Solar Generation",
    title: "Solar panels",
    body: "Rooftop panels turn sunlight into clean power for your property.",
  },
  {
    src: "/images/approach/solar-inverter.svg",
    w: 376,
    h: 583,
    alt: "A solar inverter",
    kicker: "01 · Solar Generation",
    title: "Inverter",
    body: "The inverter turns that power into electricity your property can use, and keeps the whole system in step.",
  },
  {
    src: "/images/approach/solar-battery.svg",
    w: 362,
    h: 515,
    alt: "A home battery",
    kicker: "02 · Energy Storage",
    title: "Battery storage",
    body: "A battery keeps spare solar power for the evening, and for when the grid goes down.",
  },
];

export function ApproachParts() {
  return (
    <div className="space-y-14 sm:space-y-20">
      {PARTS.map((part) => (
        <Reveal key={part.title} direction="up" duration={800} distance={28}>
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,17rem)_1fr] md:gap-14 lg:gap-20">
            <div className="relative flex justify-center">
              {/* a soft glow behind the drawing, so it has depth without a box around it */}
              <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
              <Image
                src={part.src}
                alt={part.alt}
                width={part.w}
                height={part.h}
                unoptimized
                className="relative h-64 w-auto drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)] sm:h-80 dark:drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)]"
              />
            </div>

            <div className="max-w-xl text-center md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">{part.kicker}</p>
              <h3 className="mt-3 text-2xl font-bold tracking-tight text-theme-primary sm:text-3xl">{part.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-theme-secondary sm:text-base">{part.body}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
