import Link from "next/link";
import { ArrowRight, Hammer, PlugZap, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

// The planner reads `start` to open on the matching path (built in step 5 of the website plan).
const DOORS: { icon: LucideIcon; label: string; hint: string; href: string }[] = [
  { icon: Hammer, label: "Build a new system", hint: "Solar, storage, EV charging", href: "/planner?start=build" },
  { icon: PlugZap, label: "Set up EV charging", hint: "Chargers and charging software", href: "/planner?start=charge" },
  { icon: SlidersHorizontal, label: "Manage what I have", hint: "Connect existing equipment", href: "/planner?start=manage" },
];

/** Not sure what fits? Three doors into the Energy Planner. */
export function WhereToStart() {
  return (
    <section id="where-to-start" className="section-padding bg-theme-bg scroll-mt-16">
      <div className="fluid-container">
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-10 rounded-2xl border border-theme-border bg-theme-surface px-7 py-10 sm:px-10 lg:grid-cols-5 lg:items-center lg:gap-12 lg:py-12">
            <div className="lg:col-span-2">
              <h2 className="text-[clamp(1.75rem,2.8vw,2.4rem)] font-bold leading-[1.2] tracking-tight text-theme-primary">
                Not sure what fits?
                <span className="block text-primary-gradient">Start with the planner.</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-theme-secondary sm:text-base">
                Answer a few questions about your property and see the right starting point for it.
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-3 lg:col-span-3 sm:grid-cols-3">
              {DOORS.map(({ icon: Icon, label, hint, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex h-full flex-col rounded-xl border border-theme-border bg-theme-bg p-5 transition-colors hover:border-emerald-500/50 focus-visible:border-emerald-500/50 focus-visible:outline-none"
                  >
                    <Icon className="size-5 stroke-[1.5] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span className="mt-4 text-sm font-semibold text-theme-primary">{label}</span>
                    <span className="mt-1 text-xs text-theme-secondary">{hint}</span>
                    <ArrowRight className="mt-4 size-4 text-theme-muted transition-all group-hover:translate-x-0.5 group-hover:text-theme-highlight" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
