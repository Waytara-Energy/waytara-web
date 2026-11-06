import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { WhoWeServe } from "@/components/sections/who-we-serve";
import { WhereToStart } from "@/components/sections/where-to-start";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { FeatureColumns } from "@/components/segments/segment-parts";
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

            {/* Three frameless blocks, the same look as "What WayTara does" on the landing page; each keeps its anchor for the header menu. */}
            <FeatureColumns
              items={OFFERS.map(({ id, icon, title, blockBody, includes, whoFor }) => ({ id, icon, title, body: blockBody, includes, whoFor, link: NEED_LINKS[id] }))}
            />
          </div>
        </section>

        {/* How to choose: the planner */}
        <WhereToStart />
      </main>

      <Footer />
    </div>
  );
}
