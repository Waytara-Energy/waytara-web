"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Smartphone,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PillarItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

const PILLARS: PillarItem[] = [
  {
    icon: Smartphone,
    title: "One App for Everything",
    description:
      "Control your solar generation, battery storage, and EV charging from a single, intuitive dashboard — no more switching between different apps.",
  },
  {
    icon: Sparkles,
    title: "Intelligent Savings",
    description:
      "Our smart system automatically optimizes your power in the background, storing clean energy and reducing grid bills without you lifting a finger.",
  },
  {
    icon: ShieldCheck,
    title: "One Trusted Partner",
    description:
      "From precision engineering and premium hardware installation to continuous support and warranty, we take care of everything under one roof.",
  },
];

const FULL_LINE_1 = "One Platform.";
const FULL_LINE_2 = "Total Energy Control.";

export function WhoWeAre() {
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
      id="about-us"
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden"
    >
      <div className="fluid-container">
        
        {/* 1. Top Pill Badge matching exact Image 2 Design */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
              <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
            </span>
            <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
              Who We Are ?
            </span>
          </div>
        </div>

        {/* 2. Typewriter Headline */}
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

          {/* Subtitle - Smoothly fades & slides in after typing completes */}
          <p
            className={cn(
              "text-sm sm:text-base text-theme-secondary leading-relaxed max-w-2xl transition-all duration-700 ease-out",
              typingComplete
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-3 pointer-events-none"
            )}
          >
            We combine high-performance solar, battery storage, and EV charging with smart software that connects everything into a single, effortless system for your property.
          </p>
        </div>

        {/* 3. Frameless 3-Column Content - Smoothly fades & slides in after typing completes */}
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-14 transition-all duration-700 delay-150 ease-out",
            typingComplete
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-5 pointer-events-none"
          )}
        >
          {PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="flex flex-col justify-start text-left group"
                style={{
                  transitionDelay: `${200 + idx * 100}ms`,
                }}
              >
                {/* Circular Icon Badge */}
                <div className="w-10 h-10 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-theme-primary mb-4 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                  <Icon className="w-5 h-5 stroke-[1.75]" />
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary mb-2">
                  {pillar.title}
                </h3>

                {/* Description */}
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* 4. Bottom Action Link - Smoothly fades in */}
        <div
          className={cn(
            "text-center flex justify-center transition-all duration-700 delay-300 ease-out",
            typingComplete
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3 pointer-events-none"
          )}
        >
          <Link
            href="/#customer-segments"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-theme-primary hover:text-theme-highlight underline underline-offset-4 decoration-theme-primary/30 hover:decoration-theme-highlight transition-all duration-200 group"
          >
            <span>Discover Our Services</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

      </div>
    </section>
  );
}
