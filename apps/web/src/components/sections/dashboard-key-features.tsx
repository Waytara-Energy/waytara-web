import { Activity, LifeBuoy, PlugZap, SearchCheck, SlidersHorizontal, TrendingUp, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

// What the customer dashboard really does, each point checked against the product: the live energy flow, the savings and reports (including
// scheduled e-mail reports), maintenance and faults, settings that show as pending until the inverter reports them, EV charger control with
// live sessions, and charts that show a gap where a device was offline. No "first" or "only" claims: we have not compared against every product.
const FEATURES: Feature[] = [
  {
    icon: Activity,
    title: "Watch your energy live",
    body: "Solar, battery, load, grid and EV charging on one live energy-flow diagram, with a tab for every device behind it.",
  },
  {
    icon: SlidersHorizontal,
    title: "Change settings, see them confirmed",
    body: "Change supported inverter settings from the dashboard. Each one shows as pending until the inverter itself reports the new value.",
  },
  {
    icon: PlugZap,
    title: "Run your EV charging",
    body: "Start or stop a supported charger and follow every charging session as it happens, from the same app as your solar.",
  },
  {
    icon: TrendingUp,
    title: "See what it saves you",
    body: "Generation, cost and savings by day, month and year, and reports you can build, download or have e-mailed on a schedule.",
  },
  {
    icon: SearchCheck,
    title: "Charts that tell the truth",
    body: "When a device was offline, the chart shows a clear gap instead of a made-up line, so you can trust what you are looking at.",
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
        {/* The 1px gaps show the hairline colour behind the cells, so the dividers are right at any column count. */}
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-theme-border bg-theme-border md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-theme-surface px-7 py-8 sm:px-8">
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
