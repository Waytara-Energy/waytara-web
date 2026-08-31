"use client";

import * as React from "react";
import {
  ArrowDown,
  ShieldCheck,
  Award,
  ClipboardCheck,
} from "lucide-react";
import { TEAM_MEMBERS } from "@/data/trust";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/shared/reveal";

const COMPLIANCE_PROTOCOLS = [
  {
    id: "standards",
    title: "MNRE & IEC Safety Standards",
    description:
      "Full adherence to national grid regulations, DISCOM net-metering codes, and international IEC safety standards for solar modules and battery storage.",
    icon: ShieldCheck,
  },
  {
    id: "vetting",
    title: "Tier-1 Certified Hardware",
    description:
      "We source bankable N-type TOPCon panels, modular LiFePO4 cells, and hybrid inverters with verified 10 to 25-year manufacturer warranties.",
    icon: Award,
  },
  {
    id: "checklist",
    title: "Rigorous Installation Protocols",
    description:
      "Standardized execution with 150 km/h wind-load rated structures, dual chemical earthing under 2 ohms, and dedicated surge protection devices.",
    icon: ClipboardCheck,
  },
];

export function Trust() {
  const [activeLeaderIdx, setActiveLeaderIdx] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const activeLeader = TEAM_MEMBERS[activeLeaderIdx];

  // Auto-advance testimonials every 3 seconds (pauses on hover)
  React.useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveLeaderIdx((prev) => (prev + 1) % TEAM_MEMBERS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <section
      id="trust"
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden"
    >
      <div className="fluid-container">
        
        {/* 1. Top Pill Badge */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                Compliance &amp; Leadership ?
              </span>
            </div>
          </div>
        </Reveal>

        {/* 2. Top Header */}
        <Reveal direction="up" delay={120} duration={700}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <h2 className="text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18]">
              <span className="block">Certified Standards.</span>
              <span className="block text-primary-gradient">Engineering Leadership.</span>
            </h2>
            <p className="text-sm sm:text-base text-theme-secondary leading-relaxed max-w-md lg:max-w-lg md:pb-1 font-normal">
              Our installations strictly adhere to national electrical safety codes, Tier-1 hardware benchmarks, and verified engineering standards.
            </p>
          </div>
        </Reveal>

        {/* 3. Compliance & Quality Protocols (Frameless Minimal 3-Column Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-20 sm:mb-24">
          {COMPLIANCE_PROTOCOLS.map((protocol, idx) => {
            const Icon = protocol.icon;

            return (
              <Reveal
                key={protocol.id}
                direction="up"
                delay={idx * 100}
                duration={650}
                distance={24}
              >
                <div className="flex flex-col justify-start text-left group">
                  {/* Circular Icon Badge */}
                  <div className="w-10 h-10 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-theme-primary mb-4 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                    <Icon className="w-5 h-5 stroke-[1.75]" />
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary mb-2">
                    {protocol.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal">
                    {protocol.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* 4. Engineering Leadership Testimonial Showcase (Automated & Centered) */}
        <Reveal direction="zoom" delay={160} duration={800}>
          <div
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="mt-20 sm:mt-24 text-center max-w-5xl mx-auto"
          >
            
            {/* Section Sub-heading */}
            <div className="mb-10 max-w-2xl mx-auto">
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary leading-tight">
                Our engineering leadership speaks.
              </h3>
              <p className="text-xs sm:text-sm text-theme-secondary mt-1.5 font-normal">
                The technical principles, standards, and guarantees that guide every WayTara installation.
              </p>
            </div>

            {/* Big Quote with Solid " Mark Centered & Expanded Width */}
            <div className="flex flex-col items-center justify-center mb-10 min-h-[100px] max-w-5xl mx-auto text-center">
              <div className="flex items-start justify-center gap-3 sm:gap-4 text-center max-w-4xl mx-auto">
                <span className="shrink-0 pt-0.5 text-emerald-500 dark:text-emerald-400">
                  <svg
                    className="w-6 h-6 sm:w-8 sm:h-8 fill-current inline-block"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </span>
                <p
                  key={activeLeader.id}
                  className="text-lg sm:text-xl lg:text-2xl font-medium text-theme-primary leading-relaxed tracking-tight text-center animate-in fade-in duration-300"
                >
                  {activeLeader.quote}
                </p>
              </div>
            </div>

            {/* Avatar Selector Strip (In-Place Expanding Avatars in Fixed Order) */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {TEAM_MEMBERS.map((member, idx) => {
                const isActive = idx === activeLeaderIdx;

                if (isActive) {
                  return (
                    <div
                      key={member.id}
                      className="inline-flex items-center gap-3 pl-1.5 pr-5 py-1.5 rounded-full bg-theme-surface border border-theme-border shadow-xs transition-all duration-300 animate-in fade-in zoom-in-95 cursor-pointer"
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-xs shrink-0",
                          member.avatarColor
                        )}
                      >
                        {member.initials}
                      </div>
                      <div className="text-left whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-bold text-theme-primary leading-tight">
                          {member.name}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-theme-secondary font-medium leading-tight">
                          {member.role}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setActiveLeaderIdx(idx)}
                    aria-label={`View quote by ${member.name}`}
                    title={`${member.name} - ${member.role}`}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 hover:scale-110 cursor-pointer shadow-xs",
                      member.avatarColor
                    )}
                  >
                    {member.initials}
                  </button>
                );
              })}
            </div>

          </div>
        </Reveal>

      </div>
    </section>
  );
}
