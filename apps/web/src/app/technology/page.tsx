import * as React from "react";
import Link from "next/link";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, Zap, ArrowRight, Layers, ShieldCheck, Activity } from "lucide-react";

export default function TechnologyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1 pt-28 pb-20 fluid-container max-w-5xl text-center">
        <Badge variant="gradient" className="mb-4">
          Tier-2 Engineering Hub
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-theme-primary mb-4">
          WayTara IoT &amp; <span className="text-primary-gradient">Power Architecture</span>
        </h1>
        <p className="text-base sm:text-lg text-theme-secondary max-w-2xl mx-auto leading-relaxed mb-12">
          Deep-dive into our sub-20ms transfer relay physics, thermal runaway protection, and cloud microgrid telemetry.
        </p>

        {/* Feature Highlights Grid Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12">
          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <Cpu className="h-6 w-6 text-theme-highlight mb-3" />
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              WayTara Cloud Gateway
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed">
              Sub-second sensor streaming over 4G/Wi-Fi with predictive AI cell health monitoring and automated fault isolation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <Activity className="h-6 w-6 text-theme-highlight mb-3" />
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              Sub-20ms UPS Relay
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed">
              Industrial dual-coil transfer switches ensuring sensitive computers and inverter ACs never reboot during grid outages.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <ShieldCheck className="h-6 w-6 text-theme-highlight mb-3" />
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              Active LFP BMS Safety
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed">
              Cell-level active balancing, multi-point temperature probes, and aerosol fire-suppression certified to IEC 62619 standards.
            </p>
          </div>
        </div>

        {/* Coming Soon Notice & Live CTA */}
        <div className="p-8 rounded-3xl bg-theme-surface/70 border border-theme-border max-w-2xl mx-auto shadow-sm">
          <p className="text-xs font-mono uppercase text-theme-highlight font-semibold mb-2">
            [Status: Full Whitepaper &amp; Telemetry Demo Coming in Tier 2]
          </p>
          <h4 className="text-xl font-bold text-theme-primary mb-2">
            Experience the system on your property
          </h4>
          <p className="text-sm text-theme-secondary mb-6">
            Our engineers can walk you through live telemetry dashboards during your free site assessment.
          </p>
          <Button asChild variant="gradient" size="lg" className="rounded-xl font-bold">
            <Link href="/#energy-planner">
              <Zap className="h-4 w-4 mr-2" />
              <span>Launch Interactive Energy Planner</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
