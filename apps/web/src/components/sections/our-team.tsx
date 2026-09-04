"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";
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
  /** Which edge of the section this row sits at, per the brief: row 1
   *  left, row 2 left, row 3 right — not a strict left/right alternation. */
  align: "left" | "right";
}

const TEAM: TeamMember[] = [
  {
    name: "Arun V Mahadev",
    role: "Founder, WayTara",
    highlight:
      "I started WayTara because every energy provider was building their own island — a separate app for solar, another for storage, another for EV.",
    rest: " We built the opposite instead — one platform where every source and every ecosystem comes together under a single account.",
    align: "left",
  },
  {
    name: "Devaansh Pujara",
    role: "Co-Founder, WayTara",
    highlight:
      "I co-founded WayTara because building great technology isn’t enough — the installation, approvals, and years of upkeep after have to be just as disciplined.",
    rest: " My focus is making sure that promise holds up on every rooftop, not just in a product demo.",
    align: "left",
  },
  {
    name: "Manoj Loganathan",
    role: "Software Engineer, WayTara",
    highlight:
      "I research and build WayTara’s technology end to end — the hardware integrations, the IoT and device communication, and the software that ties it all together.",
    rest: " My job is turning every new idea into something real, reliable, and ready for a customer’s rooftop.",
    align: "right",
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

        {/* 4. Team — one testimonial-style row per person (not a 3-column
            grid): quote mark, bold-lead quote, name/role + signature
            flourish below a divider, no photos. Each row docks to a
            section edge per the brief (row 1 left, row 2 left, row 3
            right) rather than spanning full width. */}
        <div className={cn("space-y-14 sm:space-y-16", signatureFont.variable)}>
          {TEAM.map((member, idx) => {
            const isRight = member.align === "right";
            return (
              <Reveal key={member.name} direction={isRight ? "left" : "right"} delay={idx * 100} duration={650} distance={24}>
                <div className={cn("max-w-2xl", isRight ? "ml-auto text-right" : "mr-auto text-left")}>
                  {/* Quote mark — no badge/background, just the glyph itself,
                      bigger now, theme-aware (brand emerald, matching the
                      accent color used for headings elsewhere in this
                      section). */}
                  <svg
                    className={cn("w-14 h-14 sm:w-16 sm:h-16 fill-emerald-600 dark:fill-emerald-400 mb-5 shrink-0", isRight && "ml-auto")}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>

                  {/* Quote — bold lead clause, regular-weight remainder, larger type */}
                  <p className="text-lg sm:text-xl lg:text-2xl leading-relaxed mb-7">
                    <span className="text-theme-primary font-bold">{member.highlight}</span>
                    <span className="text-theme-secondary font-normal">{member.rest}</span>
                  </p>

                  {/* Divider + name/role | signature */}
                  <div
                    className={cn(
                      "flex items-center gap-4 pt-5 border-t border-theme-border",
                      isRight ? "flex-row-reverse justify-end" : "justify-start"
                    )}
                  >
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
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
