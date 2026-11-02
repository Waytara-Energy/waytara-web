"use client";

import * as React from "react";
import { ArrowDown, Sun, BatteryCharging, PlugZap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemScene } from "./approach-scene";

interface SystemPart {
  n: 1 | 2 | 3 | 4;
  icon: React.ElementType;
  title: string;
  description: string;
}

// The four parts of the system, in the order the homepage copy lists them.
const PARTS: SystemPart[] = [
  {
    n: 1,
    icon: Sun,
    title: "Solar Generation",
    description: "Rooftop solar panels and an inverter turn sunlight into power your property can use.",
  },
  {
    n: 2,
    icon: BatteryCharging,
    title: "Energy Storage",
    description: "A battery keeps spare solar power for the evening, and for when the grid goes down.",
  },
  {
    n: 3,
    icon: PlugZap,
    title: "EV Charging",
    description: "Charge your vehicles from your own solar and battery, at the times that suit you.",
  },
  {
    n: 4,
    icon: Activity,
    title: "Energy Management",
    description: "One dashboard to monitor generation, usage, storage and loads, and to control them.",
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
  // The part the visitor is pointing at (hover or keyboard focus on the list below the scene); its pins light up in the scene.
  const [active, setActive] = React.useState<1 | 2 | 3 | 4 | null>(null);

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

        {/* 3. One scene with the whole system, then the four parts as a quiet list - fade & slide in after typing completes */}
        <div
          className={cn(
            "transition-all duration-700 delay-150 ease-out",
            typingComplete ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 pointer-events-none"
          )}
        >
          <SystemScene active={active} />

          <ol className="mt-8 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4" onMouseLeave={() => setActive(null)}>
            {PARTS.map((part) => {
              const Icon = part.icon;
              return (
                <li
                  key={part.title}
                  tabIndex={0}
                  onMouseEnter={() => setActive(part.n)}
                  onFocus={() => setActive(part.n)}
                  onBlur={() => setActive(null)}
                  className="group rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{part.n}</span>
                    <Icon className="size-5 stroke-[1.75] text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="mb-1.5 text-base sm:text-lg font-bold tracking-tight text-theme-primary transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {part.title}
                  </h3>
                  <p className="text-sm text-theme-secondary leading-relaxed">{part.description}</p>
                </li>
              );
            })}
          </ol>

          <p className="mt-10 text-center text-sm font-medium text-theme-secondary">
            Four parts, designed, installed and managed together as one integrated energy system.
          </p>
        </div>

      </div>
    </section>
  );
}
