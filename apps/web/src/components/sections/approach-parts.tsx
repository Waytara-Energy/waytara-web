import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";
import { BatteryVignette, EvChargerVignette, InverterVignette } from "./approach-vignettes";

interface Part {
  Vignette: React.ComponentType;
  title: string;
  body: string;
}

// What the platform does for each part of the system.
const PARTS: Part[] = [
  {
    Vignette: InverterVignette,
    title: "Every inverter, live",
    body: "See what your solar is generating, using and sending to the grid, as it happens.",
  },
  {
    Vignette: BatteryVignette,
    title: "Every battery, always in view",
    body: "See each battery's charge at a glance, and know when one is running low.",
  },
  {
    Vignette: EvChargerVignette,
    title: "EV charging, on your terms",
    body: "Charge your vehicle from your own solar, at the times that suit you.",
  },
];

// Where the hairlines go: between the cells once they sit side by side, between rows when they stack.
const DIVIDERS = ["", "border-t lg:border-t-0 lg:border-l", "border-t lg:border-t-0 lg:border-l"];

/**
 * The parts in one row (stacked below 1024 px), each a small picture of the product you can point at, with a title and a line
 * beneath. No boxes: only hairlines between the cells.
 */
export function ApproachParts() {
  return (
    <div>
      <ul className="mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-3">
        {PARTS.map(({ Vignette, title, body }, i) => (
          <li key={title} className={cn("border-theme-border", DIVIDERS[i])}>
            <Reveal direction="up" duration={800} delay={i * 120} distance={24} className="flex flex-col items-center px-6 pb-12 pt-10 text-center">
              <Vignette />
              <h3 className="mt-8 text-base font-semibold text-theme-primary">{title}</h3>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-theme-secondary">{body}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}
