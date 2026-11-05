import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { WhoWeServe } from "@/components/sections/who-we-serve";
import { WhereToStart } from "@/components/sections/where-to-start";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { OFFERS } from "@/data/offers";

// Where each need leads. Build and Charge go to the planner; Manage starts with a compatibility check (built in a later step).
const NEED_LINKS: Record<string, { label: string; href: string }> = {
  build: { label: "Plan a new system", href: "/planner?start=build" },
  charge: { label: "Set up EV charging", href: "/planner?start=charge" },
  manage: { label: "Connect what I already have", href: "/technology#compatibility" },
};

/** The Solutions hub: choose by the kind of property, or by what you need (Build, Charge, Manage). */
export function SolutionsHub() {
  return (
    <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1">
        <section className="pb-4 pt-[clamp(6.5rem,10vw,9rem)]">
          <div className="fluid-container">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Solutions</p>
            <h1 className="mt-4 max-w-4xl text-[clamp(2.2rem,4.4vw,4rem)] font-bold leading-[1.12] tracking-tight text-theme-primary">
              Energy solutions for
              <span className="block text-primary-gradient">every kind of property.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-theme-secondary sm:text-base">
              Solar, battery storage and EV charging, designed, installed and managed together. Start with the kind of property you have, or with what you need.
            </p>
          </div>
        </section>

        <WhoWeServe
          id="by-property"
          badge="By property"
          title="Start with"
          accent="your property."
          summary="Six kinds of property, each with its own page. Every card also shows the two ways in."
          showRoutes
        />

        <section id="by-need" className="section-padding scroll-mt-28">
          <div className="fluid-container">
            <Reveal direction="up" duration={700} distance={24}>
              <SectionHeader
                badge="By need"
                title="Or start with"
                accent="what you need."
                summary="Each of the three can be bought on its own, or combined."
              />
            </Reveal>

            <ul className="border-t border-theme-border">
              {OFFERS.map(({ id, icon: Icon, name, tag, title, body, includes, whoFor }) => {
                const link = NEED_LINKS[id];
                return (
                  <li key={id} id={id} className="scroll-mt-28 border-b border-theme-border">
                    <Reveal direction="up" duration={800} distance={24}>
                      <div className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-5 lg:gap-12">
                        <div className="lg:col-span-2">
                          <div className="flex items-center gap-3">
                            <Icon className="size-6 stroke-[1.5] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">
                              {name} · {tag}
                            </span>
                          </div>
                          <h3 className="mt-5 text-xl font-semibold text-theme-primary">{title}</h3>
                          <p className="mt-2 max-w-md text-sm leading-relaxed text-theme-secondary">{body}</p>
                        </div>

                        <div className="lg:col-span-3">
                          <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                            {includes.map((item) => (
                              <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-6 text-sm text-theme-secondary">
                            <span className="font-semibold text-theme-primary">Who it is for: </span>
                            {whoFor}
                          </p>
                          <Link href={link.href} className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                            {link.label}
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* How to choose: the planner */}
        <WhereToStart />
      </main>

      <Footer />
    </div>
  );
}
