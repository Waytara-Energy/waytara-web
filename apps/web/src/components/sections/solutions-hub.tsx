import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
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

            {/* Three frameless columns, the same look as "What WayTara does" on the landing page; each keeps its anchor for the header menu. */}
            <div className="grid grid-cols-1 gap-12 md:grid-cols-3 lg:gap-12">
              {OFFERS.map(({ id, icon: Icon, title, body, includes, whoFor }, i) => {
                const link = NEED_LINKS[id];
                return (
                  <div key={id} id={id} className="scroll-mt-28">
                    <Reveal direction="up" duration={650} distance={24} delay={i * 100}>
                      <div className="group flex h-full flex-col justify-start text-left">
                        <div className="mb-4">
                          <div className="flex size-10 items-center justify-center rounded-full border border-theme-border bg-theme-surface text-theme-primary transition-colors group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 dark:group-hover:text-emerald-400">
                            <Icon className="size-5 stroke-[1.75]" aria-hidden="true" />
                          </div>
                        </div>
                        <h3 className="mb-2 text-base font-bold tracking-tight text-theme-primary sm:text-lg">{title}</h3>
                        <p className="text-sm font-normal leading-relaxed text-theme-secondary sm:text-[15px]">{body}</p>
                        <ul className="mt-5 space-y-2.5 border-t border-theme-border pt-5">
                          {includes.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-5 text-sm text-theme-secondary">
                          <span className="font-semibold text-theme-primary">Who it is for: </span>
                          {whoFor}
                        </p>
                        <Link href={link.href} className="group/link mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                          {link.label}
                          <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </Reveal>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How to choose: the planner */}
        <WhereToStart />
      </main>

      <Footer />
    </div>
  );
}
