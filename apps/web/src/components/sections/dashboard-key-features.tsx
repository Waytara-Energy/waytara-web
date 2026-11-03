import { Activity, LifeBuoy, TrendingUp, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

// What the customer dashboard does, drawn from its pages: Overview and Monitoring, Performance and Reports, Maintenance and Support.
const FEATURES: Feature[] = [
  {
    icon: Activity,
    title: "Watch your energy live",
    body: "Solar, battery, load and grid on one live energy-flow diagram, with a tab for every device behind it.",
  },
  {
    icon: TrendingUp,
    title: "See what it saves you",
    body: "Generation, cost and savings by day, month and year, and reports you can download whenever you need them.",
  },
  {
    icon: LifeBuoy,
    title: "Stay ahead of faults",
    body: "Spot a device going quiet in Maintenance, then ask your engineer for help from the same app.",
  },
];

/** The key features of the software, three to a row with hairlines between them. */
export function DashboardKeyFeatures() {
  return (
    <div className="fluid-container">
      <Reveal direction="up" duration={800} distance={24}>
        <ul className="grid grid-cols-1 overflow-hidden rounded-2xl border border-theme-border bg-theme-surface md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className={cn("px-7 py-8 sm:px-8", i > 0 && "border-t border-theme-border md:border-l md:border-t-0")}>
              <Icon className="size-6 stroke-[1.5] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <h3 className="mt-6 text-base font-medium text-theme-primary">{title}</h3>
              <p className="mt-1.5 max-w-[22rem] text-sm leading-relaxed text-theme-secondary">{body}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
