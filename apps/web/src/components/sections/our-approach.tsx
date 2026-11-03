"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApproachParts } from "./approach-parts";

const FULL_LINE_1 = "One Smart Energy System.";
const FULL_LINE_2 = "Built Around You.";

export function OurApproach() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const [inView, setInView] = React.useState(false);
  const [line1, setLine1] = React.useState("");
  const [line2, setLine2] = React.useState("");
  const [currentLine, setCurrentLine] = React.useState<1 | 2>(1);
  const [typingComplete, setTypingComplete] = React.useState(false);

  // Trigger typing once when user scrolls into the section
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Typewriter effect sequence
  React.useEffect(() => {
    if (!inView) return;

    let timeout: NodeJS.Timeout;

    if (currentLine === 1) {
      if (line1.length < FULL_LINE_1.length) {
        timeout = setTimeout(() => {
          setLine1(FULL_LINE_1.slice(0, line1.length + 1));
        }, 55);
      } else {
        timeout = setTimeout(() => {
          setCurrentLine(2);
        }, 180);
      }
    } else if (currentLine === 2) {
      if (line2.length < FULL_LINE_2.length) {
        timeout = setTimeout(() => {
          setLine2(FULL_LINE_2.slice(0, line2.length + 1));
        }, 45);
      } else {
        timeout = setTimeout(() => {
          setTypingComplete(true);
        }, 250);
      }
    }

    return () => clearTimeout(timeout);
  }, [inView, line1, line2, currentLine]);

  return (
    <section
      ref={sectionRef}
      id="our-approach"
      className="section-padding bg-theme-bg relative z-10 scroll-mt-16 overflow-hidden"
    >
      <div className="fluid-container">

        {/* 1. Top pill badge */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
              <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
            </span>
            <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
              Our Approach
            </span>
          </div>
        </div>

        {/* 2. Split header: typewriter title on the left, summary at the right end (as in Who We Serve) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <h2 className="min-h-[2.36em] text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18] select-none">
            {/* Line 1 */}
            <span className="block">
              {line1}
              {currentLine === 1 && !typingComplete && (
                <span className="inline-block w-[3px] h-[0.85em] bg-emerald-500 ml-1.5 align-middle animate-pulse" />
              )}
            </span>

            {/* Line 2 */}
            <span className="block text-primary-gradient">
              {line2}
              {currentLine === 2 && !typingComplete && (
                <span className="inline-block w-[3px] h-[0.85em] bg-emerald-500 ml-1.5 align-middle animate-pulse" />
              )}
            </span>
          </h2>

          {/* Body - fades & slides in after typing completes */}
          <p
            className={cn(
              "text-sm sm:text-base text-theme-secondary leading-relaxed max-w-md lg:max-w-lg md:pb-1 transition-all duration-700 ease-out",
              typingComplete
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-3 pointer-events-none"
            )}
          >
            We bring together the technologies your property needs to generate, store, use and manage power as one coordinated energy system.
          </p>
        </div>

        {/* 3. The four parts as small interactive pictures - fade & slide in after typing completes */}
        <div
          className={cn(
            "transition-all duration-700 delay-100 ease-out",
            typingComplete ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 pointer-events-none"
          )}
        >
          <ApproachParts />
        </div>

      </div>
    </section>
  );
}
