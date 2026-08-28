"use client";

import * as React from "react";
import {
  Sun,
  Battery,
  BatteryCharging,
  Zap,
  Smartphone,
  ShieldCheck,
  Car,
  Sliders,
  Cpu,
  FileCheck,
  Building2,
  TrendingUp,
  LayoutDashboard,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";
import { SOLUTION_PACKAGES } from "@/data/packages";
import { CustomerSegmentId, SolutionPackage } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  Sun,
  Battery,
  BatteryCharging,
  Zap,
  Smartphone,
  ShieldCheck,
  Car,
  Sliders,
  Cpu,
  FileCheck,
  Building2,
  TrendingUp,
  LayoutDashboard,
};

interface SolutionPackagesProps {
  selectedSegment: CustomerSegmentId;
  onConfigurePackage?: (pkg: SolutionPackage) => void;
}

export function SolutionPackages({
  selectedSegment,
  onConfigurePackage,
}: SolutionPackagesProps) {
  const sortedPackages = React.useMemo(() => {
    return [...SOLUTION_PACKAGES].sort((a, b) => {
      if (a.targetSegment === selectedSegment && b.targetSegment !== selectedSegment) return -1;
      if (b.targetSegment === selectedSegment && a.targetSegment !== selectedSegment) return 1;
      if (a.isPopular && !b.isPopular) return -1;
      if (b.isPopular && !a.isPopular) return 1;
      return 0;
    });
  }, [selectedSegment]);

  const handleConfigure = (pkg: SolutionPackage) => {
    if (onConfigurePackage) onConfigurePackage(pkg);
    const el = document.getElementById("energy-planner");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="solution-packages" className="section-padding relative">
      <div className="fluid-container">
        
        {/* Minimal Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="eyebrow-label justify-center">
            <span>PACKAGES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
            Turnkey Clean Energy{" "}
            <span className="text-primary-gradient">Solution Packages.</span>
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-theme-secondary">
            Pre-engineered hardware bundles with matched inverters, storage, and telemetry.
          </p>
        </div>

        {/* 5 Solution Package Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {sortedPackages.map((pkg) => {
            const isMatch = pkg.targetSegment === selectedSegment;

            return (
              <div
                key={pkg.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-2xl border transition-all duration-200 p-5 sm:p-6",
                  pkg.isPopular && isMatch
                    ? "bg-theme-surface border-emerald-500/70 ring-1 ring-emerald-500/30 shadow-md -translate-y-0.5"
                    : "bg-theme-surface/70 border-theme-border hover:border-emerald-500/40 hover:bg-theme-surface shadow-xs"
                )}
              >
                {pkg.isPopular && isMatch && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="gradient" className="px-2.5 py-0.5 text-[10px] font-bold">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      Recommended
                    </Badge>
                  </div>
                )}

                <div>
                  <div className="mb-2">
                    <span className="text-[10px] font-mono uppercase font-bold text-theme-highlight tracking-wider block">
                      {pkg.targetSegment === "home"
                        ? "Residential"
                        : pkg.targetSegment === "commercial"
                        ? "Commercial & Industrial"
                        : "EV Mobility"}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-theme-primary mt-0.5">
                      {pkg.name}
                    </h3>
                  </div>

                  <p className="text-xs text-theme-secondary leading-relaxed min-h-[34px]">
                    {pkg.tagline}
                  </p>

                  <div className="my-3.5 p-2.5 rounded-xl bg-theme-surface-hover/70 border border-theme-border/60 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between text-theme-primary">
                      <span className="text-theme-muted">Solar Array:</span>
                      <span className="font-semibold">{pkg.solarCapacity}</span>
                    </div>
                    <div className="flex items-center justify-between text-theme-primary">
                      <span className="text-theme-muted">Storage:</span>
                      <span className="font-semibold">{pkg.batteryCapacity}</span>
                    </div>
                    <div className="flex items-center justify-between text-theme-primary">
                      <span className="text-theme-muted">EV Port:</span>
                      <span className="font-semibold">{pkg.evCharging}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted block">
                      Key Inclusions:
                    </span>
                    <ul className="space-y-1.5">
                      {pkg.inclusions.slice(0, 4).map((inc, idx) => {
                        const IconComponent = ICON_MAP[inc.icon] || Check;
                        return (
                          <li key={idx} className="flex items-start gap-2 text-xs">
                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-theme-highlight-subtle text-theme-highlight mt-0.5">
                              <IconComponent className="h-3 w-3" />
                            </div>
                            <span className="text-theme-secondary text-[11px] leading-tight">
                              <strong className="text-theme-primary font-medium">{inc.title}</strong> — {inc.description}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-theme-border/60">
                  <div className="mb-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-theme-muted">Estimated Turnkey:</span>
                      <span className="text-base sm:text-lg font-extrabold text-theme-highlight">
                        {pkg.priceRange.formatted}
                      </span>
                    </div>
                    <p className="text-[10px] text-theme-muted mt-0.5 leading-tight">
                      {pkg.priceRange.factors}
                    </p>
                  </div>

                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => handleConfigure(pkg)}
                    className="w-full justify-center text-xs h-9 font-semibold"
                  >
                    <span>Configure Package</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
