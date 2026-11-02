"use client";

import * as React from "react";
import { ArrowDown, Sun, BatteryCharging, PlugZap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SolarIllustration, BatteryIllustration, EvIllustration, DashboardIllustration } from "./approach-illustrations";

interface SystemPart {
  icon: React.ElementType;
  title: string;
  description: string;
  art: React.ReactNode;
}

// The four parts of the system, in the order the homepage copy lists them.
const PARTS: SystemPart[] = [
  {
    icon: Sun,
    title: "Solar Generation",
    description: "Rooftop solar panels and an inverter turn sunlight into power your property can use.",
    art: <SolarIllustration />,
  },
  {
    icon: BatteryCharging,
    title: "Energy Storage",
    description: "A battery keeps spare solar power for the evening, and for when the grid goes down.",
    art: <BatteryIllustration />,
  },
  {
    icon: PlugZap,
    title: "EV Charging",
    description: "Charge your vehicles from your own solar and battery, at the times that suit you.",
    art: <EvIllustration />,
  },
  {
    icon: Activity,
    title: "Energy Management",
    description: "One dashboard to monitor generation, usage, storage and loads, and to control them.",
    art: <DashboardIllustration />,
  },
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

        {/* 3. The four parts as cards, each with its own drawing - fade & slide in after typing completes */}
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 transition-all duration-700 delay-150 ease-out",
            typingComplete
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-5 pointer-events-none"
          )}
        >
          {PARTS.map((part, idx) => {
            const Icon = part.icon;
            return (
              <article
                key={part.title}
                className="group relative flex flex-col sm:flex-row sm:items-center gap-4 overflow-hidden rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-7 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-600/5"
                style={{ transitionDelay: `${200 + idx * 100}ms` }}
              >
                <div className="relative z-10 sm:w-[44%] sm:shrink-0">
                  <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Icon className="size-5 stroke-[1.75]" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mb-2">
                    {part.title}
                  </h3>
                  <p className="text-sm text-theme-secondary leading-relaxed">{part.description}</p>
                </div>

                <div className="mx-auto w-full max-w-[19rem] sm:max-w-none sm:flex-1 transition-transform duration-500 group-hover:-translate-y-1">
                  {part.art}
                </div>
              </article>
            );
          })}
        </div>

        {/* 4. One line tying the four together */}
        <p
          className={cn(
            "mt-8 text-center text-sm font-medium text-theme-secondary transition-all duration-700 delay-500 ease-out",
            typingComplete ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
          )}
        >
          Four parts, designed, installed and managed together as one integrated energy system.
        </p>

      </div>
    </section>
  );
}
