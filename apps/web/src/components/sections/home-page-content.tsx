import { Navigation } from "@/components/sections/navigation";
import { Hero } from "@/components/sections/hero";
import { OurApproach } from "@/components/sections/our-approach";
import { EquipmentStrip } from "@/components/sections/equipment-strip";
import { WhatWeDo } from "@/components/sections/what-we-do";
import { DashboardShowcase } from "@/components/sections/dashboard-showcase";
import { WhoWeServe } from "@/components/sections/who-we-serve";
import { ProjectSteps } from "@/components/sections/project-steps";
import { WhereToStart } from "@/components/sections/where-to-start";
import { FinalCTA } from "@/components/sections/final-cta";
import { Footer } from "@/components/sections/footer";

/**
 * The landing page, in story order (docs/WEBSITE_PLAN.md section 5): the promise, the idea, what WayTara does,
 * who it is for, how a project runs, the dashboard, where to start, and the close.
 */
export function HomePageContent() {
  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1">
        {/* 1. The promise */}
        <Hero />

        {/* 2. The idea: one coordinated system, shown as small live pictures of its parts */}
        <OurApproach />

        {/* 2b. What it connects: the equipment, as a row of icons */}
        <EquipmentStrip />

        {/* 3. What WayTara does: Build, Charge, Manage */}
        <WhatWeDo />

        {/* 4. Who we serve: the six property types */}
        <WhoWeServe />

        {/* 5. How a project works */}
        <ProjectSteps />

        {/* 6. One dashboard: a card that tips up on scroll, showing the live Monitoring page (moved here: it follows "Four steps, one team.") */}
        <DashboardShowcase />

        {/* 7. Where to start: the planner */}
        <WhereToStart />

        {/* 8. The close (Why WayTara has its own page, in the header menu) */}
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
