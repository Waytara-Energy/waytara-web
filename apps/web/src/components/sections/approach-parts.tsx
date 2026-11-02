import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";

interface Part {
  src: string;
  /** the drawing's own proportions (its cropped viewBox), so it is never squashed */
  w: number;
  h: number;
  alt: string;
  /** SVGs are served as they are; the charger is a raster */
  svg: boolean;
}

// The four parts of the system, side by side in one row. No cards and no text.
const PARTS: Part[] = [
  { src: "/images/approach/solar-panel.svg", w: 346, h: 698, alt: "A solar panel", svg: true },
  { src: "/images/approach/solar-inverter.svg", w: 376, h: 583, alt: "A solar inverter", svg: true },
  { src: "/images/approach/solar-battery.svg", w: 362, h: 515, alt: "A home battery", svg: true },
  { src: "/images/approach/ev-charger.webp", w: 615, h: 987, alt: "An EV charger", svg: false },
];

export function ApproachParts() {
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-8 lg:gap-12">
      {PARTS.map((part, i) => (
        <Reveal key={part.src} direction="up" duration={800} delay={i * 120} distance={28}>
          <div className="relative flex justify-center">
            {/* a soft glow behind the drawing, so it has depth without a box around it */}
            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
            <Image
              src={part.src}
              alt={part.alt}
              width={part.w}
              height={part.h}
              unoptimized={part.svg}
              sizes="(min-width: 1024px) 220px, 30vw"
              className="relative h-[min(30vw,20rem)] w-auto drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)]"
            />
          </div>
        </Reveal>
      ))}
    </div>
  );
}
