"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  Layers,
  Compass,
  Zap,
  ShieldCheck,
  FileCheck2,
  Activity,
  ArrowUpRight,
  XCircle,
  TrendingDown,
  SmartphoneNfc,
  ShieldAlert,
  ZapOff,
  UserX,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/shared/reveal";

const WAYTARA_ON_ITEMS = [
  {
    id: "integrated",
    title: "Integrated System Design",
    description:
      "Solar generation, battery storage, and EV charging engineered as one harmonized electrical architecture, eliminating multi-vendor compatibility issues.",
    icon: Layers,
  },
  {
    id: "site-engineering",
    title: "Site-Specific Engineering",
    description:
      "Every roof undergoes 3D shadow analysis, structural load assessment, and sanctioned grid capacity checks before installation.",
    icon: Compass,
  },
  {
    id: "certified-hardware",
    title: "Tier-1 Certified Hardware",
    description:
      "BIS and IEC certified N-type TOPCon panels, modular LiFePO4 battery storage, and smart hybrid inverters with proven durability.",
    icon: Zap,
  },
  {
    id: "net-metering",
    title: "Net Metering & Approvals",
    description:
      "Our team handles all DISCOM net-metering applications, CEIG electrical safety clearances, and PM Surya Ghar subsidy processing on your behalf.",
    icon: FileCheck2,
  },
  {
    id: "single-warranty",
    title: "Single-Point Warranty",
    description:
      "A single contract and accountable engineering partner for installation, equipment warranties, and ongoing operations & maintenance.",
    icon: ShieldCheck,
  },
  {
    id: "live-telemetry",
    title: "Live Telemetry & Diagnostics",
    description:
      "Track daily generation, battery charge levels, and grid offset in real time through our unified dashboard with proactive fault alerts.",
    icon: Activity,
  },
];

const TRADITIONAL_OFF_ITEMS = [
  {
    id: "fragmented",
    title: "Fragmented Multi-Vendor Sourcing",
    description:
      "Panels from brand A, inverter from shop B, and batteries from brand C — leading to severe mismatch losses and zero unified communication.",
    icon: XCircle,
  },
  {
    id: "voltage-losses",
    title: "Uncalibrated Voltage Losses",
    description:
      "Generic string layouts causing 12% – 18% DC clipping losses and premature cell degradation under high-temperature Indian summers.",
    icon: TrendingDown,
  },
  {
    id: "multi-app",
    title: "Multi-App Confusion",
    description:
      "Separate, disconnected apps for solar, inverter, and EV charging with zero automated solar surplus routing or load balancing.",
    icon: SmartphoneNfc,
  },
  {
    id: "warranty-nightmare",
    title: "4-Way Warranty Finger-Pointing",
    description:
      "When equipment trips, panel manufacturers blame the inverter company, who blames the battery brand, who blames the electrician.",
    icon: ShieldAlert,
  },
  {
    id: "slow-transfer",
    title: "Slow Power Cut Flickers",
    description:
      "Lagging mechanical changeovers cause Wi-Fi disconnections, AC compressor trips, and computer reboots during every grid blackout.",
    icon: ZapOff,
  },
  {
    id: "vanishing-support",
    title: "Vanishing Post-Sale Support",
    description:
      "Unorganized local installers vanish after commissioning, leaving properties with zero ongoing maintenance or diagnostic support.",
    icon: UserX,
  },
];

function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  duration = 1400,
  inView,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  inView: boolean;
}) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;

    let startTime: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic curve: 1 - (1 - x)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(easeOut * target);

      setCount(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrameId);
  }, [inView, target, duration]);

  return (
    <span>
      {prefix}
      {inView ? count : 0}
      {suffix}
    </span>
  );
}

export function WhyIntegratedSystem() {
  const [isToggled, setIsToggled] = React.useState(true);
  const snapshotRef = React.useRef<HTMLDivElement>(null);
  const [snapshotInView, setSnapshotInView] = React.useState(false);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSnapshotInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (snapshotRef.current) {
      observer.observe(snapshotRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const currentItems = isToggled ? WAYTARA_ON_ITEMS : TRADITIONAL_OFF_ITEMS;

  return (
    <section
      id="why-integrated"
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden transition-colors duration-500"
    >
      <div className="fluid-container">
        
        {/* 1. Top Pill Badge */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                {isToggled ? "Why WayTara ?" : "Traditional Multi-Vendor Pitfalls ?"}
              </span>
            </div>

            {/* Interactive Mode Hint */}
            <button
              type="button"
              onClick={() => setIsToggled(!isToggled)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isToggled ? "Flip switch to see what you miss" : "Switch back to WayTara"}</span>
            </button>
          </div>
        </Reveal>

        {/* 2. Top Header with Interactive Toggle Switch & Action Button */}
        <Reveal direction="up" delay={120} duration={700}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
            
            {/* Left Headline with Dynamic Toggle State */}
            <div>
              <h2 className="text-[clamp(2.3rem,4.4vw,3.9rem)] font-bold tracking-tight text-theme-primary leading-[1.18]">
                <span className="block">When properties</span>
                <span className="inline-flex items-center flex-wrap gap-2.5 sm:gap-3.5 mt-1">
                  <span>{isToggled ? "switch" : "don't"}</span>
                  
                  {/* Interactive Toggle Capsule */}
                  <button
                    type="button"
                    onClick={() => setIsToggled(!isToggled)}
                    aria-label="Toggle WayTara clean power"
                    title="Click to toggle comparison"
                    className={cn(
                      "inline-flex items-center w-14 sm:w-16 h-7 sm:h-8 rounded-full p-1 transition-colors duration-300 cursor-pointer shadow-inner shrink-0",
                      isToggled
                        ? "bg-emerald-600 dark:bg-emerald-500"
                        : "bg-slate-400 dark:bg-slate-600"
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ease-out",
                        isToggled ? "translate-x-7 sm:translate-x-8" : "translate-x-0"
                      )}
                    />
                  </button>

                  <span>{isToggled ? "to WayTara." : "choose WayTara."}</span>
                </span>
              </h2>
            </div>

            {/* Right Action Button */}
            <div className="md:self-center shrink-0">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-400 hover:via-emerald-500 hover:to-green-500 hover:shadow-emerald-600/30 hover:scale-105 transition-all duration-200 group cursor-pointer"
              >
                <span>{isToggled ? "Book a Free Site Audit" : "Upgrade to WayTara"}</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

          </div>
        </Reveal>

        {/* 3. Six Value Pillars (Dynamic on Toggle) */}
        <div
          key={isToggled ? "waytara-on" : "traditional-off"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12"
        >
          {currentItems.map((item, idx) => {
            const Icon = item.icon;

            return (
              <Reveal
                key={item.id}
                direction="up"
                delay={idx * 70}
                duration={600}
                distance={24}
              >
                <div className="flex flex-col justify-start text-left group">
                  {/* Circular Icon Badge */}
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110",
                      isToggled
                        ? "bg-theme-surface border border-theme-border text-theme-primary group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                        : "bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20"
                    )}
                  >
                    <Icon className="w-5 h-5 stroke-[1.8]" />
                  </div>

                  {/* Title */}
                  <h3
                    className={cn(
                      "text-lg font-bold tracking-tight mb-2 transition-colors",
                      isToggled
                        ? "text-theme-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* 4. Engineering Architecture Snapshot Grid (Dynamic on Toggle) */}
        <Reveal direction="up" delay={150} duration={750}>
          <div
            ref={snapshotRef}
            key={isToggled ? "snapshot-on" : "snapshot-off"}
            className="mt-20 sm:mt-24"
          >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 xl:gap-16 items-start">
            
            {/* Column 1: Editorial Statement */}
            <div className="text-left pr-0 md:pr-4">
              <p className="text-base sm:text-lg lg:text-xl font-medium text-theme-primary leading-relaxed">
                {isToggled
                  ? "WayTara is an integrated clean energy platform. This is a snapshot of how our engineered architecture and smart software deliver total power independence."
                  : "Without an integrated partner, properties face fragmented warranties, voltage mismatch losses, and multiple disconnected vendor portals."}
              </p>
            </div>

            {/* Column 2: Stats 1 & 3 */}
            <div className="space-y-12 sm:space-y-16 text-left">
              {/* Stat 1 */}
              <div
                className={cn(
                  "border-l pl-8 sm:pl-10 space-y-2",
                  isToggled ? "border-theme-border/60" : "border-red-500/40"
                )}
              >
                <div
                  className={cn(
                    "text-5xl sm:text-6xl font-extrabold tracking-tight leading-none",
                    isToggled ? "text-theme-primary" : "text-red-500 dark:text-red-400"
                  )}
                >
                  {isToggled ? (
                    <AnimatedCounter
                      inView={snapshotInView}
                      target={20}
                      prefix="<"
                      suffix="ms"
                      duration={1400}
                    />
                  ) : (
                    "> 3s"
                  )}
                </div>
                <p className="text-xs sm:text-sm text-theme-secondary font-normal leading-relaxed">
                  {isToggled
                    ? "Instant power switchover (zero-flicker backup)"
                    : "Power cut changeover lag (AC & Wi-Fi reset)"}
                </p>
              </div>

              {/* Stat 3 */}
              <div
                className={cn(
                  "border-l pl-8 sm:pl-10 space-y-2",
                  isToggled ? "border-theme-border/60" : "border-red-500/40"
                )}
              >
                <div
                  className={cn(
                    "text-5xl sm:text-6xl font-extrabold tracking-tight leading-none",
                    isToggled ? "text-theme-primary" : "text-red-500 dark:text-red-400"
                  )}
                >
                  {isToggled ? (
                    <AnimatedCounter
                      inView={snapshotInView}
                      target={1}
                      suffix=" OS"
                      duration={1000}
                    />
                  ) : (
                    "3 Apps"
                  )}
                </div>
                <p className="text-xs sm:text-sm text-theme-secondary font-normal leading-relaxed">
                  {isToggled
                    ? "Unified cloud firmware & real-time telemetry"
                    : "Disconnected vendor apps with zero automation"}
                </p>
              </div>
            </div>

            {/* Column 3: Stats 2 & 4 */}
            <div className="space-y-12 sm:space-y-16 text-left">
              {/* Stat 2 */}
              <div
                className={cn(
                  "border-l pl-8 sm:pl-10 space-y-2",
                  isToggled ? "border-theme-border/60" : "border-red-500/40"
                )}
              >
                <div
                  className={cn(
                    "text-5xl sm:text-6xl font-extrabold tracking-tight leading-none",
                    isToggled ? "text-theme-primary" : "text-red-500 dark:text-red-400"
                  )}
                >
                  {isToggled ? (
                    <AnimatedCounter
                      inView={snapshotInView}
                      target={0}
                      suffix="%"
                      duration={1000}
                    />
                  ) : (
                    "18%"
                  )}
                </div>
                <p className="text-xs sm:text-sm text-theme-secondary font-normal leading-relaxed">
                  {isToggled
                    ? "Junction & DC clipping losses"
                    : "Annual solar clipping & mismatch losses"}
                </p>
              </div>

              {/* Stat 4 */}
              <div
                className={cn(
                  "border-l pl-8 sm:pl-10 space-y-2",
                  isToggled ? "border-theme-border/60" : "border-red-500/40"
                )}
              >
                <div
                  className={cn(
                    "text-5xl sm:text-6xl font-extrabold tracking-tight leading-none",
                    isToggled ? "text-theme-primary" : "text-red-500 dark:text-red-400"
                  )}
                >
                  {isToggled ? (
                    <AnimatedCounter
                      inView={snapshotInView}
                      target={25}
                      suffix=" Yrs"
                      duration={1600}
                    />
                  ) : (
                    "0 SLA"
                  )}
                </div>
                <p className="text-xs sm:text-sm text-theme-secondary font-normal leading-relaxed">
                  {isToggled
                    ? "Single accountable warranty SLA"
                    : "Zero single-point accountability or guarantees"}
                </p>
              </div>
            </div>

          </div>
        </div>
        </Reveal>

      </div>
    </section>
  );
}
