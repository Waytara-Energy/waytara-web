"use client";

import * as React from "react";
import { ArrowDown, Sun, BatteryCharging, PlugZap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemNode {
  icon: React.ElementType;
  title: string;
  /** Where the node sits around the centre on a computer (the grid is 3 x 3 with the centre in the middle). */
  place: string;
}

// The four parts of the system, in the order the homepage copy lists them.
const NODES: SystemNode[] = [
  { icon: Sun, title: "Solar Generation", place: "md:col-start-2 md:row-start-1" },
  { icon: BatteryCharging, title: "Energy Storage", place: "md:col-start-1 md:row-start-2" },
  { icon: PlugZap, title: "EV Charging", place: "md:col-start-3 md:row-start-2" },
  { icon: Activity, title: "Energy Management", place: "md:col-start-2 md:row-start-3" },
];

const FULL_LINE_1 = "One energy system,";
const FULL_LINE_2 = "designed around your property.";

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
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden"
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

        {/* 2. Typewriter headline */}
        <div className="max-w-4xl mb-12 min-h-[140px] sm:min-h-[160px]">
          <h2 className="text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18] mb-4 select-none">
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
              "text-sm sm:text-base text-theme-secondary leading-relaxed max-w-2xl transition-all duration-700 ease-out",
              typingComplete
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-3 pointer-events-none"
            )}
          >
            We bring together the technologies your property needs to generate, store, use and manage power as one coordinated energy system.
          </p>
        </div>

        {/* 3. The system: four parts around one centre label - fades & slides in after typing completes */}
        <div
          className={cn(
            "relative mx-auto max-w-3xl grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 md:grid-rows-3 md:gap-y-10 transition-all duration-700 delay-150 ease-out",
            typingComplete
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-5 pointer-events-none"
          )}
        >
          {/* Lines from the centre to the four parts (computer screens only) */}
          <div aria-hidden="true" className="hidden md:block absolute left-1/2 top-[16%] bottom-[16%] w-px -translate-x-1/2 bg-gradient-to-b from-emerald-500/10 via-emerald-500/40 to-emerald-500/10" />
          <div aria-hidden="true" className="hidden md:block absolute top-1/2 left-[14%] right-[14%] h-px -translate-y-1/2 bg-gradient-to-r from-emerald-500/10 via-emerald-500/40 to-emerald-500/10" />

          {NODES.map((node, idx) => {
            const Icon = node.icon;
            return (
              <div
                key={node.title}
                className={cn("relative z-10 flex flex-col items-center text-center group", node.place)}
                style={{ transitionDelay: `${200 + idx * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-theme-primary mb-3 shadow-sm group-hover:bg-emerald-500/10 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                  <Icon className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary">
                  {node.title}
                </h3>
              </div>
            );
          })}

          {/* Centre label */}
          <div className="relative z-10 col-span-2 order-first flex items-center justify-center md:order-none md:col-span-1 md:col-start-2 md:row-start-2">
            <div className="relative flex size-36 sm:size-40 items-center justify-center rounded-full bg-theme-bg">
              <span aria-hidden="true" className="absolute inset-0 rounded-full border border-emerald-500/40 motion-safe:animate-pulse" />
              <span aria-hidden="true" className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/25" />
              <span className="relative px-6 text-center text-[0.7rem] sm:text-xs font-bold uppercase leading-snug tracking-[0.16em] text-theme-primary">
                Integrated Energy System
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
