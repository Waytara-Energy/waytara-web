import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";
import { BatteryVignette, DashboardVignette, EvChargerVignette, InverterVignette } from "./approach-vignettes";

interface Part {
  Vignette: React.ComponentType;
  title: string;
  body: string;
}

// What the platform does for each part, ending with the point of it all: every device in one application, across your sites.
const PARTS: Part[] = [
  {
    Vignette: InverterVignette,
    title: "Every inverter, live",
    body: "See what your solar is generating, using and sending to the grid, as it happens.",
  },
  {
    Vignette: BatteryVignette,
    title: "Battery, always in view",
    body: "Know your charge level and when your backup is ready, before you need it.",
  },
  {
    Vignette: EvChargerVignette,
    title: "EV charging, on your terms",
    body: "Charge your vehicle from your own solar, at the times that suit you.",
  },
  {
    Vignette: DashboardVignette,
    title: "One app, every site",
    body: "Every device in a single application, however many sites you manage.",
  },
];

// Where the hairlines go: a cross between the four cells once they sit two by two, between rows when they stack on a phone.
const DIVIDERS = ["", "border-t sm:border-t-0 sm:border-l", "border-t", "border-t sm:border-l"];

/**
 * The four parts in a two by two grid, each a small picture of the product you can point at, with a title and a line beneath.
 * No boxes: only hairlines between the cells.
 */
export function ApproachParts() {
  return (
    <div>
      <ul className="mx-auto grid max-w-4xl grid-cols-1 sm:grid-cols-2">
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
      <p className="mt-2 text-center text-xs text-theme-muted">Move your cursor over each picture to try it.</p>
    </div>
  );
}
