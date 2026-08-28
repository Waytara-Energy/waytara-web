import * as React from "react";
import Link from "next/link";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, ArrowRight, Zap, HelpCircle } from "lucide-react";

export default function KnowledgeCentrePage() {
  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1 pt-28 pb-20 fluid-container max-w-5xl text-center">
        <Badge variant="gradient" className="mb-4">
          Education &amp; Policy
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-theme-primary mb-4">
          WayTara <span className="text-primary-gradient">Knowledge Centre</span>
        </h1>
        <p className="text-base sm:text-lg text-theme-secondary max-w-2xl mx-auto leading-relaxed mb-12">
          Educational guides on rooftop solar net metering, battery safety lifespans, PM Surya Ghar subsidies, and green energy ROI.
        </p>

        {/* Featured Guide Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-12">
          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <Badge variant="outline" className="mb-3 text-[10px]">
              Policy Guide
            </Badge>
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              PM Surya Ghar: Muft Bijli Yojana Explained (2025–2026)
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed mb-4">
              Comprehensive breakdown of central subsidy slabs (up to ₹78,000 for 3kW), state DISCOM application portals, and bank collateral-free loans.
            </p>
            <span className="text-xs font-semibold text-theme-highlight">
              Full Guide Available on Site Assessment →
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-theme-surface border border-theme-border">
            <Badge variant="outline" className="mb-3 text-[10px]">
              Technical Whitepaper
            </Badge>
            <h3 className="font-bold text-lg text-theme-primary mb-2">
              LFP vs NMC vs Lead-Acid in High Heat Climates
            </h3>
            <p className="text-xs text-theme-secondary leading-relaxed mb-4">
              Why Lithium Iron Phosphate (LiFePO4) chemistry delivers 6,000 cycles without thermal runaway risks under 45°C Indian peak summers.
            </p>
            <span className="text-xs font-semibold text-theme-highlight">
              Full Whitepaper Coming in Tier 2 →
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="p-8 rounded-3xl bg-theme-surface/70 border border-theme-border max-w-2xl mx-auto shadow-sm">
          <h4 className="text-xl font-bold text-theme-primary mb-2">
            Calculate your specific property figures
          </h4>
          <p className="text-sm text-theme-secondary mb-6">
            Our recommendation engine applies state-specific tariffs and solar irradiance numbers automatically.
          </p>
          <Button asChild variant="gradient" size="lg" className="rounded-xl font-bold">
            <Link href="/#energy-planner">
              <Zap className="h-4 w-4 mr-2" />
              <span>Calculate Your Solar &amp; Battery Sizing</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
