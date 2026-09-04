"use client";

import * as React from "react";
import { ArrowDown, Telescope, Compass, Target } from "lucide-react";
import { Caveat } from "next/font/google";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

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

interface VisionMissionGoalItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

/** Same frameless icon-badge pattern as WhyIntegratedSystem's PILLARS /
 *  Trust's COMPLIANCE_PROTOCOLS — reused here rather than the plain
 *  label+paragraph style this block started with, for visual consistency
 *  across the page. */
const VISION_MISSION_GOAL: VisionMissionGoalItem[] = [
  {
    icon: Telescope,
    title: "Our Vision",
    description:
      "We want every property in India to generate, store, and use its own power on its own terms — engineered as one intelligent system, not a patchwork of disconnected vendors.",
  },
  {
    icon: Compass,
    title: "Our Mission",
    description:
      "We design, install, and stand behind integrated solar, battery, and EV charging systems — one standard, one accountable team, monitored in real time so you never have to wonder if it’s working.",
  },
  {
    icon: Target,
    title: "Our Goal",
    description:
      "We want to be the reason a property owner in India never has to think about their power supply again — one system, one warranty, one team accountable for all of it.",
  },
];

const TEAM: TeamMember[] = [
  {
    name: "Arun V Mahadev",
    role: "Founder, WayTara",
    highlight:
      "I started WayTara because every energy provider was building their own island — a separate app for solar, another for storage, another for EV.",
    rest: " We built the opposite instead — one platform where every source and every ecosystem comes together under a single account.",
  },
  {
    name: "Devaansh Pujara",
    role: "Co-Founder, WayTara",
    highlight:
      "I co-founded WayTara because building great technology isn’t enough — the installation, approvals, and years of upkeep after have to be just as disciplined.",
    rest: " My focus is making sure that promise holds up on every rooftop, not just in a product demo.",
  },
  {
    name: "Manoj Loganathan",
    role: "Software Engineer, WayTara",
    highlight:
      "I research and build WayTara’s technology end to end — the hardware integrations, the IoT and device communication, and the software that ties it all together.",
    rest: " My job is turning every new idea into something real, reliable, and ready for a customer’s rooftop.",
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

        {/* 3. Vision, Mission & Goal — same frameless icon-badge grid as
            WhyIntegratedSystem's pillars / Trust's compliance protocols
            (circular icon badge, bold title, description), for visual
            consistency with the rest of the page. All first-person
            ("we"/"our") — this is WayTara speaking, not a narrator
            describing WayTara. Same grid-cols-3/gap as the Team grid
            below (no max-w cap here) so the two 3-column rows share
            identical column boundaries instead of drifting out of line. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mt-10 mb-16 sm:mb-20">
          {VISION_MISSION_GOAL.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} direction="up" delay={180 + idx * 100} duration={650} distance={24}>
                <div className="flex flex-col justify-start text-left group">
                  <div className="w-10 h-10 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-theme-primary mb-4 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                    <Icon className="w-5 h-5 stroke-[1.75]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal line-clamp-4">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* 4. Team — row 1: Arun + Devaansh side by side, centered as a
            pair; row 2: Manoj alone, centered. Every card's own content
            stays left-aligned (quote mark pinned to its top-left corner,
            never centered) — only the row as a whole is centered within
            the section, not each card's internals. Extra top clearance
            and wider gaps than a plain text grid would need, so each
            card's big decorative quote mark (offset up/left, behind the
            text) has room to sit without crowding its neighbor or the
            Vision/Mission/Goal block above. */}
        <div className={cn("space-y-20 sm:space-y-28 mt-8 sm:mt-12", signatureFont.variable)}>
          {/* Full container width now (was capped at max-w-4xl, leaving big
              unused gutters either side) — matches the Vision/Mission/Goal
              grid above, which already spans the full fluid-container. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-16 gap-x-12 lg:gap-x-20">
            <TeamCard member={TEAM[0]} delay={0} />
            <TeamCard member={TEAM[1]} delay={100} />
          </div>
          <div className="max-w-2xl mx-auto">
            <TeamCard member={TEAM[2]} delay={200} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamCard({ member, delay }: { member: TeamMember; delay: number }) {
  return (
    <Reveal direction="up" delay={delay} duration={650} distance={24}>
      <div className="relative">
        {/* Big decorative quote mark, sitting behind the text (not part of
            the centered block, not a small icon — a large grey glyph
            pinned to the card's own top-left corner, per the reference).
            Smaller and tucked in close now — the previous size/offset
            pushed it up into the Vision/Mission/Goal row above instead of
            sitting behind its own card's text. */}
        <span
          aria-hidden="true"
          className="absolute -top-3 -left-2 sm:-top-6 sm:-left-4 lg:-top-8 lg:-left-6 -z-10 text-6xl sm:text-8xl lg:text-9xl font-serif text-theme-border leading-none select-none"
        >
          &#8246;
        </span>

        {/* Text size matches why-integrated.tsx's "WayTara is an
            integrated clean energy platform..." paragraph exactly. */}
        <div className="text-center relative">
          {/* Quote — bold lead clause, regular-weight remainder, capped at
              8 lines so no member's card can run arbitrarily long */}
          <p className="text-base sm:text-lg lg:text-xl leading-relaxed mb-7 line-clamp-8">
            <span className="text-theme-primary font-bold">{member.highlight}</span>
            <span className="text-theme-secondary font-normal">{member.rest}</span>
          </p>

          {/* Divider + name/role | signature */}
          <div className="flex items-center justify-center gap-4 pt-5 border-t border-theme-border">
            <div className="min-w-0">
              <p className="text-base font-bold text-theme-primary truncate">{member.name}</p>
              <p className="text-sm text-theme-muted truncate">{member.role}</p>
            </div>
            <div className="w-px h-10 bg-theme-border shrink-0" aria-hidden="true" />
            <span
              className="text-4xl text-theme-secondary shrink-0"
              style={{ fontFamily: "var(--font-signature)" }}
            >
              {member.name.split(" ")[0]}
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
