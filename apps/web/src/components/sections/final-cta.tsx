"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Sparkles, PhoneCall, ShieldCheck, Zap, Activity } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { TEMP_HIDE_LANDING_SECTIONS } from "@/config/landing-flags";

export function FinalCTA() {
  const scrollToPlanner = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("energy-planner");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="section-padding bg-theme-bg relative overflow-hidden text-center scroll-mt-16">
      
      {/* Soft Ambient Radial Glow with pulse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-500/15 via-teal-500/8 to-transparent rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />

      <div className="fluid-container max-w-4xl relative">
        
        {/* 1. Top Pill Badge */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                One Single System ?
              </span>
            </div>
          </div>
        </Reveal>

        {/* 2. Main Headline */}
        <Reveal direction="up" delay={120} duration={700}>
          <h2 className="text-[clamp(2.2rem,4.2vw,3.8rem)] font-bold tracking-tight text-theme-primary leading-[1.15] mb-5">
            <span className="block">Ready to integrate into</span>
            <span className="block text-primary-gradient">one single system?</span>
          </h2>
        </Reveal>

        {/* 3. Supporting Description */}
        <Reveal direction="up" delay={180} duration={700}>
          <p className="text-sm sm:text-base text-theme-secondary max-w-2xl mx-auto leading-relaxed font-normal mb-10">
            Eliminate fragmented vendors, multi-app confusion, and grid rate shocks. Run your solar generation, Smart LFP storage, and EV charging as one intelligent, self-balancing power plant with Tara AI.
          </p>
        </Reveal>

        {/* 4. Action Buttons
            TEMP_HIDE_LANDING_SECTIONS (src/config/landing-flags.ts): while
            on, only "Speak with an Engineer" shows, carrying the green
            gradient the "Plan with Tara AI" button (hidden along with the
            Energy Planner section it scrolled to) used to have. Both
            buttons come back once the flag flips off. */}
        <Reveal direction="zoom" delay={240} duration={750}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-12">

            {/* Primary Action -> Plan with Tara AI */}
            {!TEMP_HIDE_LANDING_SECTIONS && (
              <button
                type="button"
                onClick={scrollToPlanner}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 text-white text-sm sm:text-[15px] font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-400 hover:via-emerald-500 hover:to-green-500 hover:shadow-emerald-600/35 hover:scale-105 active:scale-95 transition-all duration-200 group cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-200 transition-transform group-hover:rotate-12" />
                <span>Plan with Tara AI</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            )}

            {/* Speak with an Engineer — green gradient while
                TEMP_HIDE_LANDING_SECTIONS is on (it's the only button
                showing), the original neutral/bordered style otherwise. */}
            <Link
              href="/contact"
              className={
                TEMP_HIDE_LANDING_SECTIONS
                  ? "w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 text-white text-sm sm:text-[15px] font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-400 hover:via-emerald-500 hover:to-green-500 hover:shadow-emerald-600/35 hover:scale-105 active:scale-95 transition-all duration-200 group cursor-pointer"
                  : "w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-theme-surface border border-theme-border text-theme-primary text-sm sm:text-[15px] font-semibold shadow-xs hover:bg-[#EBF4EC] dark:hover:bg-[#16271C] hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:shadow-lg hover:shadow-emerald-600/10 hover:scale-105 active:scale-95 transition-all duration-200 group cursor-pointer"
              }
            >
              <PhoneCall
                className={
                  TEMP_HIDE_LANDING_SECTIONS
                    ? "w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform"
                    : "w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"
                }
              />
              <span>Speak with an Engineer</span>
            </Link>

          </div>
        </Reveal>

        {/* 5. Minimal Engineering Guarantees — TEMP_HIDE_LANDING_SECTIONS
            (src/config/landing-flags.ts), restored once it flips off. */}
        {!TEMP_HIDE_LANDING_SECTIONS && (
          <Reveal direction="fade" delay={300} duration={800}>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-[13px] text-theme-secondary">
              <span className="flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Single 25-Yr Accountable Warranty</span>
              </span>
              <span className="flex items-center gap-2 font-medium">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Sub-20ms Zero-Flicker Backup</span>
              </span>
              <span className="flex items-center gap-2 font-medium">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>24/7 Tara AI Cloud Telemetry</span>
              </span>
            </div>
          </Reveal>
        )}

      </div>
    </section>
  );
}
