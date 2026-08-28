"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  Compass,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/shared/reveal";

const STEPS = [
  {
    step: "01",
    title: "Free Consultation",
    description:
      "Our power systems engineers analyze your electricity bills, sanctioned load, and shadow-free roof area at zero upfront cost.",
    linkText: "Schedule a consultation",
    href: "/contact",
    icon: ClipboardCheck,
    badgeStyle: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    lineStyle: "border-l-2 border-emerald-500/30",
  },
  {
    step: "02",
    title: "Custom Design",
    description:
      "We build a precision 3D digital twin of your property to simulate solar irradiance, size battery storage, and synchronize multi-vendor hardware.",
    linkText: "See custom engineering",
    href: "/#energy-planner",
    icon: Compass,
    badgeStyle: "border-2 border-dashed border-emerald-500/60 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    lineStyle: "border-l-2 border-dashed border-emerald-500/30",
  },
  {
    step: "03",
    title: "Seamless Installation",
    description:
      "Turnkey execution, DISCOM net-metering approvals, CEIG permits, and 24/7 cloud telemetry activation under a single 25-year warranty.",
    linkText: "Get in touch",
    href: "/contact",
    icon: Wrench,
    badgeStyle: "border-2 border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    lineStyle: "border-l-2 border-emerald-500/30",
  },
];

export function HowItWorks() {
  const handleAnchorClick = (href: string, e: React.MouseEvent) => {
    if (href.startsWith("/#")) {
      const targetId = href.replace("/#", "");
      const el = document.getElementById(targetId);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", `#${targetId}`);
      }
    }
  };

  return (
    <section
      id="how-it-works"
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden"
    >
      <div className="fluid-container">
        
        {/* 1. Top Pill Badge matching Who We Are / Who We Serve */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                How It Works ?
              </span>
            </div>
          </div>
        </Reveal>

        {/* 2. Split Section Header */}
        <Reveal direction="up" delay={120} duration={700}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <h2 className="text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18]">
              <span className="block">From Vision to Power.</span>
              <span className="block text-primary-gradient">Three Seamless Steps.</span>
            </h2>
            <p className="text-sm sm:text-base text-theme-secondary leading-relaxed max-w-md lg:max-w-lg md:pb-1">
              We manage every phase from initial engineering feasibility to utility paperwork, turnkey commissioning, and lifetime smart OS monitoring.
            </p>
          </div>
        </Reveal>

        {/* 3. Three-Column Minimal Timeline Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-12">
          {STEPS.map((stepItem, index) => {
            const Icon = stepItem.icon;

            return (
              <Reveal
                key={stepItem.title}
                direction="up"
                delay={index * 140}
                duration={700}
                distance={30}
              >
                <div className="flex gap-4 sm:gap-5 group text-left">
                  {/* Left Column: Icon Badge & Descending Guideline */}
                  <div className="flex flex-col items-center shrink-0">
                    {/* Circular Icon Badge */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/20",
                        stepItem.badgeStyle
                      )}
                    >
                      <Icon className="w-5 h-5 stroke-[1.8]" />
                    </div>

                    {/* Vertical Guide Line */}
                    <div
                      className={cn(
                        "flex-1 w-0 min-h-[100px] sm:min-h-[130px] my-3",
                        stepItem.lineStyle
                      )}
                    />
                  </div>

                  {/* Right Column: Title, Description & Action Link */}
                  <div className="pt-1.5 space-y-3 pb-8">
                    {/* Title */}
                    <h3 className="text-xl sm:text-[22px] font-bold tracking-tight text-theme-primary leading-snug">
                      {stepItem.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal">
                      {stepItem.description}
                    </p>

                    {/* Action Link */}
                    <div className="pt-2">
                      <Link
                        href={stepItem.href}
                        onClick={(e) => handleAnchorClick(stepItem.href, e)}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors group/link cursor-pointer"
                      >
                        <span>{stepItem.linkText}</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/link:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* 4. Bottom Action Link -> Guides to Interactive Energy Planner */}
        <Reveal direction="fade" delay={250} duration={600}>
          <div className="text-center flex justify-center pt-2">
            <Link
              href="/#energy-planner"
              onClick={(e) => handleAnchorClick("/#energy-planner", e)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-theme-primary hover:text-theme-highlight underline underline-offset-4 decoration-theme-primary/30 hover:decoration-theme-highlight transition-all duration-200 group cursor-pointer"
            >
              <span>Start Your Interactive Energy Planner</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </Reveal>

      </div>
    </section>
  );
}
