"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";
import { Caveat } from "next/font/google";
import { Reveal } from "@/components/shared/reveal";

// Signature-style flourish for each card's name (see TEAM_SIGNATURE below) —
// scoped to this component via its own CSS variable, not the site's brand
// fonts (Poppins/Outfit) set in layout.tsx.
const signatureFont = Caveat({ weight: ["600"], subsets: ["latin"], display: "swap", variable: "--font-signature" });

interface TeamMember {
  name: string;
  role: string;
  /** Bold lead clause — the "hook" of the quote. */
  highlight: string;
  /** Regular-weight remainder, continuing straight on from `highlight`. */
  rest: string;
}

const TEAM: TeamMember[] = [
  {
    name: "Arun V Mahadev",
    role: "Founder, WayTara",
    highlight:
      "I started WayTara to close the gap between what India’s homes and businesses could get from clean energy, and what actually gets installed on the ground.",
    rest: " Our engineering and installation standards exist so every system we ship carries one accountable warranty — not a stack of separate vendor promises. I’m building infrastructure people can trust for 25 years, not just for the day it’s switched on.",
  },
  {
    name: "Devaansh Pujara",
    role: "Co-Founder, WayTara",
    highlight:
      "I co-founded WayTara to bring the same rigor to clean energy delivery that any serious engineering project demands,",
    rest: " from site assessment and DISCOM approvals through to long-term operations and maintenance. I work closely with our customers and partners to make sure our promise of one integrated system holds up in practice, not just on paper.",
  },
  {
    name: "Manoj Loganathan",
    role: "Software Engineer, WayTara",
    highlight:
      "I build the software behind WayTara’s customer dashboard and device telemetry platform,",
    rest: " the systems that turn a solar inverter’s raw data into the live monitoring, alerts, and controls our customers see every day. My work connects the hardware installed on a rooftop to the account a customer checks on their phone.",
  },
];

/**
 * Minimal, text-only team + vision/mission/goal section — deliberately
 * no photos or avatar graphics per the brief. Team cards follow a
 * testimonial-quote layout (quote-mark badge, bold-lead quote, a
 * name/role + signature-style flourish beneath a divider) rather than
 * the plain name/role/paragraph stack used elsewhere, per reference.
 * Every line of copy is first-person ("we"/"I") — WayTara and its
 * people speaking directly, not a narrator describing them.
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

        {/* 3. Vision, Mission & Goal — three plain text columns, no cards/borders,
            all first-person ("we"/"our") — this is WayTara speaking, not a
            narrator describing WayTara. Same grid-cols-3/gap as the Team
            grid below (no max-w cap here) so the two 3-column rows share
            identical column boundaries instead of drifting out of line. */}
        <Reveal direction="up" delay={180} duration={700}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mt-10 mb-16 sm:mb-20">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                Our Vision
              </h3>
              <p className="text-sm sm:text-base text-theme-primary leading-relaxed font-medium">
                We want every property in India to generate, store, and use its own power on its own terms
                — engineered as one intelligent system, not a patchwork of disconnected vendors.
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
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                Our Goal
              </h3>
              <p className="text-sm sm:text-base text-theme-primary leading-relaxed font-medium">
                We want to be the reason a property owner in India never has to think about their power
                supply again — one system, one warranty, one team accountable for all of it.
              </p>
            </div>
          </div>
        </Reveal>

        {/* 4. Team — testimonial-style quote cards (quote-mark badge, bold-lead
            quote, name/role + signature flourish below a divider), no photos. */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 ${signatureFont.variable}`}>
          {TEAM.map((member, idx) => (
            <Reveal key={member.name} direction="up" delay={idx * 100} duration={650} distance={24}>
              <div className="flex flex-col justify-start text-left h-full">
                {/* Quote-mark badge */}
                <div className="w-11 h-11 rounded-xl bg-[#0F1E14] dark:bg-[#1B2B20] flex items-center justify-center mb-5 shrink-0">
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>

                {/* Quote — bold lead clause, regular-weight remainder */}
                <p className="text-sm sm:text-base leading-relaxed mb-6 flex-1">
                  <span className="text-theme-primary font-bold">{member.highlight}</span>
                  <span className="text-theme-secondary font-normal">{member.rest}</span>
                </p>

                {/* Divider + name/role | signature */}
                <div className="flex items-center gap-4 pt-5 border-t border-theme-border">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-theme-primary truncate">{member.name}</p>
                    <p className="text-xs text-theme-muted truncate">{member.role}</p>
                  </div>
                  <div className="w-px h-9 bg-theme-border shrink-0" aria-hidden="true" />
                  <span
                    className="text-3xl text-theme-secondary shrink-0"
                    style={{ fontFamily: "var(--font-signature)" }}
                  >
                    {member.name.split(" ")[0]}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
