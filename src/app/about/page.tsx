import * as React from "react";
import Link from "next/link";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Users, Target, Zap, ArrowRight } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1 pt-28 pb-20 fluid-container max-w-5xl text-center">
        <Badge variant="gradient" className="mb-4">
          Our Story &amp; Mission
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-theme-primary mb-4">
          Pioneering One Intelligent <span className="text-primary-gradient">Energy Partner</span>
        </h1>
        <p className="text-base sm:text-lg text-theme-secondary max-w-2xl mx-auto leading-relaxed mb-12">
          WayTara was founded by power systems engineers frustrated with fragmented hardware sales, dishonest generation estimates, and non-existent warranties in the rooftop solar market.
        </p>

        {/* Mission Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12">
          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <Target className="h-6 w-6 text-theme-highlight mb-3" />
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              Our Vision
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed">
              Every home and commercial property generating, storing, and managing its own clean, resilient energy with zero grid blackout vulnerability.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <ShieldCheck className="h-6 w-6 text-theme-highlight mb-3" />
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              Single Accountability
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed">
              We design the architecture, install with our certified engineers, connect proprietary IoT telemetry, and back it under one phone call.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <Users className="h-6 w-6 text-theme-highlight mb-3" />
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              Engineering Rigor
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed">
              Strict 30-point ISO 9001 installation checklists, Tier-1 audited supply chains, and transparent engineering calculations.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-3xl bg-theme-surface/70 border border-theme-border max-w-2xl mx-auto shadow-sm">
          <h4 className="text-xl font-bold text-theme-primary mb-2">
            Ready to design your energy system?
          </h4>
          <p className="text-sm text-theme-secondary mb-6">
            Get an instant sizing recommendation in 60 seconds with our interactive planner.
          </p>
          <Button asChild variant="gradient" size="lg" className="rounded-xl font-bold">
            <Link href="/#energy-planner">
              <Zap className="h-4 w-4 mr-2" />
              <span>Start Your Energy Assessment</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
