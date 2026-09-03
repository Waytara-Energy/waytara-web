"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

interface TeamMember {
  name: string;
  role: string;
  bio: string;
}

const TEAM: TeamMember[] = [
  {
    name: "Arun V Mahadev",
    role: "Founder, WayTara",
    bio: "Arun founded WayTara to close the gap between India's residential and commercial clean energy potential and what actually gets installed on the ground. He sets the engineering and installation standards behind every system WayTara ships — the reason it's one accountable warranty, not a stack of separate vendor promises. His focus is building infrastructure people can trust for 25 years, not just for the day it's switched on.",
  },
  {
    name: "Devaansh Pujara",
    role: "Co-Founder, WayTara",
    bio: "Devaansh co-founded WayTara to bring the same rigor to clean energy delivery that complex engineering projects demand — from site assessment and DISCOM approvals through to long-term operations and maintenance. He works closely with customers and partners to make sure WayTara's promise of one integrated system holds up in practice, not just on paper.",
  },
  {
    name: "Manoj",
    role: "Software Engineer, WayTara",
    bio: "Manoj builds the software behind WayTara's customer dashboard and device telemetry platform — the systems that turn a solar inverter's raw data into the live monitoring, alerts, and controls customers see every day. His work connects the hardware installed on a rooftop to the account a customer checks on their phone.",
  },
];

/**
 * Minimal, text-only team + vision/mission section — deliberately no
 * photos or avatar graphics per the brief, just clean typography
 * matching the "frameless minimal grid" pattern already used by
 * WhoWeAre's pillars and Trust's compliance protocols.
 */
export function OurTeam() {
  return (
    <section
      id="our-team"
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden"
    >
      <div className="fluid-container">
        {/* 1. Top Pill Badge — matches every other section's header */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                Our Team ?
              </span>
            </div>
          </div>
        </Reveal>

        {/* 2. Heading */}
        <Reveal direction="up" delay={120} duration={700}>
          <h2 className="text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18] mb-4 max-w-3xl">
            <span className="block">The people building</span>
            <span className="block text-primary-gradient">WayTara.</span>
          </h2>
        </Reveal>

        {/* 3. Vision & Mission — two plain text columns, no cards/borders */}
        <Reveal direction="up" delay={180} duration={700}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 mt-10 mb-16 sm:mb-20 max-w-4xl">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                Our Vision
              </h3>
              <p className="text-sm sm:text-base text-theme-primary leading-relaxed font-medium">
                An India where every property generates, stores, and uses its own power on its own terms —
                engineered as one intelligent system, not a patchwork of disconnected vendors.
              </p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                Our Mission
              </h3>
              <p className="text-sm sm:text-base text-theme-primary leading-relaxed font-medium">
                We design, install, and stand behind integrated solar, battery, and EV charging systems —
                built to a single standard, backed by one accountable team, and monitored in real time so
                our customers never have to wonder if their system is working.
              </p>
            </div>
          </div>
        </Reveal>

        {/* 4. Team — frameless minimal 3-column grid, text only (no photos) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {TEAM.map((member, idx) => (
            <Reveal key={member.name} direction="up" delay={idx * 100} duration={650} distance={24}>
              <div className="flex flex-col justify-start text-left">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary">
                  {member.name}
                </h3>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">
                  {member.role}
                </p>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal">
                  {member.bio}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
