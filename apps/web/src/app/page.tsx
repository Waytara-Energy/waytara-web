"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "@/components/sections/navigation";
import { Hero } from "@/components/sections/hero";
import { WhoWeAre } from "@/components/sections/who-we-are";
import { CustomerSegments } from "@/components/sections/customer-segments";
import { EnergyPlanner } from "@/components/sections/energy-planner";
import { HowItWorks } from "@/components/sections/how-it-works";
import { WhyIntegratedSystem } from "@/components/sections/why-integrated";
import { Trust } from "@/components/sections/trust";
import { FAQ } from "@/components/sections/faq";
import { FinalCTA } from "@/components/sections/final-cta";
import { Footer } from "@/components/sections/footer";
import { CustomerSegmentId } from "@/types";
import { TEMP_HIDE_LANDING_SECTIONS } from "@/config/landing-flags";

function HomeContent() {
  const searchParams = useSearchParams();
  const segmentParam = searchParams.get("for") as CustomerSegmentId | null;

  // Track customer segment state (defaults to 'home' or reads '?for=...')
  const [selectedSegment, setSelectedSegment] = React.useState<CustomerSegmentId>("home");

  React.useEffect(() => {
    if (
      segmentParam &&
      (segmentParam === "home" ||
        segmentParam === "commercial" ||
        segmentParam === "ev_fleet")
    ) {
      setSelectedSegment(segmentParam);
    }
  }, [segmentParam]);

  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      {/* 4.1 Navigation */}
      <Navigation />

      <main className="flex-1">
        {/* 4.2 Hero Section with Background Video */}
        <Hero />

        {/* 4.3 Who We Are (About Us Section) */}
        <WhoWeAre />

        {/* 4.4 Customer Segments (Home, Commercial, EV Fleet) */}
        <CustomerSegments
          selectedSegment={selectedSegment}
          onSelectSegment={setSelectedSegment}
        />

        {/* 4.5 How It Works (3-Step Execution: Consultation, Design, Installation)
            — TEMP_HIDE_LANDING_SECTIONS, see src/config/landing-flags.ts */}
        {!TEMP_HIDE_LANDING_SECTIONS && <HowItWorks />}

        {/* 4.6 Energy Planner (Interactive AI Agent Flow) — TEMP_HIDE_LANDING_SECTIONS */}
        {!TEMP_HIDE_LANDING_SECTIONS && <EnergyPlanner selectedSegment={selectedSegment} />}

        {/* 4.7 Why an Integrated System (2-track comparison) */}
        <WhyIntegratedSystem />

        {/* 4.8 Trust (Leadership, Philosophy, Standards & Checklist) — TEMP_HIDE_LANDING_SECTIONS */}
        {!TEMP_HIDE_LANDING_SECTIONS && <Trust />}

        {/* 4.9 FAQ (Money, Battery, Solar + dynamic segment switch) — TEMP_HIDE_LANDING_SECTIONS */}
        {!TEMP_HIDE_LANDING_SECTIONS && <FAQ selectedSegment={selectedSegment} />}

        {/* 4.10 Final CTA */}
        <FinalCTA />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function HomePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-theme-bg text-theme-primary">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-sm">Loading WayTara Energy...</span>
          </div>
        </div>
      }
    >
      <HomeContent />
    </React.Suspense>
  );
}
