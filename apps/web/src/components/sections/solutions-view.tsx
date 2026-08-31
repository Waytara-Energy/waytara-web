"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Home,
  Building,
  Factory,
  Building2,
  Truck,
  Cpu,
  Sun,
  BatteryCharging,
  Zap,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Smartphone,
  Sliders,
  DollarSign,
  Car,
  FileCheck,
  FileText,
  Server,
  Layers,
  Leaf,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CalendarCheck,
  Award,
  BarChart3,
  Activity,
  RotateCcw,
  Moon,
} from "lucide-react";
import {
  SEGMENT_SOLUTIONS_DATA,
  SEGMENT_KEYS,
  SegmentSolutionData,
  normalizeSegmentSlug,
  SOLAR_TOPOLOGIES_DATA,
  TOPOLOGY_COMPARISON_MATRIX,
  SOLAR_TOPOLOGY_CONSOLIDATED_FAQS,
  SolarTopologyDetail,
} from "@/data/solutions-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal, StaggerContainer } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";
import { AssessmentModal } from "./assessment-modal";

const getTopologyStepIcon = (iconName: string) => {
  switch (iconName) {
    case "Sun":
      return Sun;
    case "Zap":
      return Zap;
    case "Home":
      return Home;
    case "ArrowUpRight":
      return ArrowUpRight;
    case "Moon":
      return Moon;
    case "BatteryCharging":
      return BatteryCharging;
    case "TrendingDown":
      return TrendingDown;
    case "Smartphone":
      return Smartphone;
    case "Layers":
      return Layers;
    default:
      return Zap;
  }
};

interface SolutionsViewProps {
  initialSegment?: string;
}

const SEGMENT_TABS = [
  { id: "home", label: "Home", sub: "Villas & Residences", icon: Home, path: "/solutions/home" },
  { id: "apartment", label: "Apartment", sub: "Gated Societies & RWAs", icon: Building, path: "/solutions/apartment" },
  { id: "factory", label: "Factory", sub: "Heavy Industry & MW Plants", icon: Factory, path: "/solutions/factory" },
  { id: "commercial", label: "Commercial", sub: "Offices, Hospitals & Retail", icon: Building2, path: "/solutions/commercial" },
  { id: "ev_fleet", label: "EV Fleet", sub: "Transit & Logistics Depots", icon: Truck, path: "/solutions/ev-fleet" },
  { id: "it_park", label: "IT Park", sub: "Tech Campuses & Data Centers", icon: Cpu, path: "/solutions/it-park" },
];

const TOPIC_ITEMS = [
  { id: "topology", number: "1", label: "System Hardware Topology" },
  { id: "comparison", number: "2", label: "Comparative Engineering Matrix" },
  { id: "packages", number: "3", label: "Turnkey Capacity Packages" },
  { id: "financials", number: "4", label: "Financial Economics & LCOE" },
  { id: "faqs", number: "5", label: "Frequently Asked Questions" },
  { id: "consultation", number: "6", label: "Engineering Consultation" },
];

export function SolutionsView({ initialSegment = "home" }: SolutionsViewProps) {
  const router = useRouter();
  const normalizedInitial = normalizeSegmentSlug(initialSegment);
  const [activeSegmentId, setActiveSegmentId] = React.useState<string>(normalizedInitial);
  const [activeTopicId, setActiveTopicId] = React.useState<string>("topology");
  const [activeTopologyTab, setActiveTopologyTab] = React.useState<"on_grid" | "hybrid" | "off_grid">("on_grid");
  const [selectedHardwareTier, setSelectedHardwareTier] = React.useState<number>(0);
  const [powerFlowMode, setPowerFlowMode] = React.useState<"day" | "night">("day");
  const [isComparisonToggled, setIsComparisonToggled] = React.useState<boolean>(true);
  const [selectedPackageIndex, setSelectedPackageIndex] = React.useState<number>(1);
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);
  const [assessmentModalOpen, setAssessmentModalOpen] = React.useState(false);

  // Sync state if initialSegment prop changes
  React.useEffect(() => {
    const norm = normalizeSegmentSlug(initialSegment);
    setActiveSegmentId(norm);
    setSelectedPackageIndex(1);
  }, [initialSegment]);

  // Scrollspy observer for "ON THIS PAGE" topics
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const topic of TOPIC_ITEMS) {
        const el = document.getElementById(topic.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveTopicId(topic.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const activeData: SegmentSolutionData =
    SEGMENT_SOLUTIONS_DATA[activeSegmentId] || SEGMENT_SOLUTIONS_DATA.home;

  const handleSelectSegment = (tabId: string, path: string) => {
    setActiveSegmentId(tabId);
    setOpenFaqIndex(0);
    window.history.pushState(null, "", path);
  };

  const scrollToTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    const element = document.getElementById(topicId);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const getMetricIcon = (iconName: string) => {
    switch (iconName) {
      case "Sun":
        return Sun;
      case "BatteryCharging":
        return BatteryCharging;
      case "Zap":
        return Zap;
      case "TrendingDown":
        return TrendingDown;
      case "Car":
        return Car;
      default:
        return Zap;
    }
  };

  const getHardwareIcon = (iconName: string) => {
    switch (iconName) {
      case "Sun":
        return Sun;
      case "BatteryCharging":
        return BatteryCharging;
      case "Zap":
        return Zap;
      case "Smartphone":
        return Smartphone;
      case "Server":
        return Server;
      case "Car":
        return Car;
      default:
        return Layers;
    }
  };

  return (
    <div className="space-y-10 sm:space-y-14 pb-24">
      
      {/* 1. Header & Breadcrumb Pill */}
      <div className="pt-8 sm:pt-12">
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                Solutions &amp; Engineering Blueprints
              </span>
            </div>
          </div>
        </Reveal>

        {/* Split Headline & Description */}
        <Reveal direction="up" delay={120} duration={700}>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-10 mb-10">
            <div className="max-w-2xl xl:max-w-3xl">
              <h1 className="text-[clamp(2rem,3.4vw,3.2rem)] font-bold tracking-tight text-theme-primary leading-[1.18]">
                <span>Integrated Energy Solutions. </span>
                <span className="text-primary-gradient block sm:inline">Engineered by Segment.</span>
              </h1>
            </div>
            <p className="text-sm sm:text-base text-theme-secondary leading-relaxed max-w-md lg:max-w-lg lg:pb-1 shrink-0">
              Select your property category below to explore bespoke hardware topologies, financial economics, government subsidies, and turnkey capacity packages.
            </p>
          </div>
        </Reveal>

        {/* 2. Interactive Segment Selector Tabs */}
        <Reveal direction="up" delay={180} duration={700}>
          <div className="relative">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {SEGMENT_TABS.map((tab) => {
                const isActive = activeSegmentId === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectSegment(tab.id, tab.path)}
                    className={cn(
                      "p-3.5 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between gap-3 group cursor-pointer relative",
                      isActive
                        ? "bg-theme-surface border-emerald-600/70 dark:border-emerald-500/60 shadow-[0_2px_12px_-2px_rgba(16,185,129,0.12)]"
                        : "bg-theme-surface/40 border-theme-border/70 hover:border-theme-border hover:bg-theme-surface/80"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                          isActive
                            ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                            : "bg-theme-bg/80 text-theme-muted group-hover:text-theme-primary"
                        )}
                      >
                        <Icon className="w-4 h-4 stroke-[1.8]" />
                      </div>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </div>

                    <div>
                      <div
                        className={cn(
                          "text-xs sm:text-[13px] leading-tight font-semibold transition-colors",
                          isActive
                            ? "text-theme-primary"
                            : "text-theme-secondary group-hover:text-theme-primary"
                        )}
                      >
                        {tab.label}
                      </div>
                      <div className="text-[11px] text-theme-muted mt-0.5 leading-snug truncate">
                        {tab.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ========================================================================= */}
      {/* 1. FULL HERO IMAGE BANNER (MINIMAL OVERLAY) */}
      {/* ========================================================================= */}
      <Reveal direction="up" delay={220} duration={700}>
        <div className="relative rounded-3xl overflow-hidden min-h-[300px] sm:min-h-[360px] md:min-h-[400px] border border-theme-border shadow-sm flex flex-col justify-end">
          {/* Full-Bleed Background Image */}
          <Image
            src={activeData.heroImage}
            alt={activeData.name}
            fill
            priority
            unoptimized
            className="object-cover object-center"
          />

          {/* Subtle Frosted Blur across bottom */}
          <div
            className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none backdrop-blur-md z-0"
            style={{
              maskImage: "linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
              WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
            }}
          />

          {/* Subtle gradient for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none z-0" />

          {/* Bottom-Left Minimal Title & Subtitle */}
          <div className="relative z-10 p-6 sm:p-8 max-w-2xl text-white space-y-1.5">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
              {activeData.tagline}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-300/90 font-medium tracking-wide">
              {activeData.category}
            </p>
          </div>
        </div>
      </Reveal>
      {/* ========================================================================= */}
      {/* 2. EDITORIAL ARCHITECTURAL SNAPSHOT & METRIC GRID */}
      {/* ========================================================================= */}
      <Reveal direction="up" delay={260} duration={750}>
        <div className="py-2 sm:py-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-start">
            
            {/* Column 1: Editorial Overview & Direct CTAs */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-6 text-left">
              <p className="text-base sm:text-lg lg:text-xl font-medium text-theme-primary leading-relaxed">
                {activeData.executiveSummary}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => setAssessmentModalOpen(true)}
                  className="h-10 px-5 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                  <span>Book Feasibility Study</span>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 text-xs font-semibold rounded-xl border-theme-border cursor-pointer hover:border-emerald-500/40"
                >
                  <Link href={`/?for=${activeSegmentId}#energy-planner`}>
                    <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                    <span>Launch Energy Planner</span>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Column 2 & 3: 4 Architectural Spec Metrics with Icons & Left Border Bars */}
            <div className="lg:col-span-7 xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 text-left">
              {activeData.metrics.map((m, idx) => {
                const Icon = getMetricIcon(m.icon);
                return (
                  <div
                    key={idx}
                    className="border-l-2 border-theme-border/80 pl-6 sm:pl-8 space-y-2.5 group hover:border-emerald-500/60 transition-colors"
                  >
                    {/* Metric Value on Top */}
                    <div className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-theme-primary leading-none">
                      {m.value}{" "}
                      <span className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {m.unit}
                      </span>
                    </div>

                    {/* Label with Icon and Subtitle below */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-theme-primary">
                        <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{m.label}</span>
                      </div>
                      <p className="text-xs text-theme-secondary font-normal leading-relaxed">
                        {m.sub}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </Reveal>

      {/* ========================================================================= */}
      {/* 3. SPLIT DOCUMENTATION LAYOUT (LEFT: TOPICS | RIGHT: CONTENT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start pt-2">
        
        {/* LEFT COLUMN: PURE MINIMAL STICKY "ON THIS PAGE" NAVIGATION (UNBOXED) */}
        <aside className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 space-y-3 pr-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-theme-muted mb-4 select-none">
            ON THIS PAGE
          </div>

          <nav className="space-y-1 text-xs">
            {TOPIC_ITEMS.map((topic) => {
              const isActive = activeTopicId === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => scrollToTopic(topic.id)}
                  className={cn(
                    "w-full text-left py-1.5 pl-3 transition-all flex items-center gap-2 cursor-pointer select-none text-xs leading-relaxed",
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold border-l-2 border-emerald-500"
                      : "text-theme-muted hover:text-theme-primary border-l-2 border-transparent font-normal"
                  )}
                >
                  <span className="truncate">
                    {topic.number}. {topic.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT COLUMN: DETAILED SECTION CONTENT */}
        <main className="lg:col-span-8 xl:col-span-9 space-y-16 sm:space-y-20">

          {/* SECTION 1: SYSTEM HARDWARE TOPOLOGY & SOLAR ARCHITECTURES */}
          <section id="topology" className="scroll-mt-24 space-y-10">
            
            {/* Section Header */}
            <div className="space-y-1.5 pb-4 border-b border-theme-border">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
                1. System Hardware &amp; Solar Topologies
              </h2>
              <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                Explore how On-Grid, Hybrid, and Off-Grid solar systems operate in practice, compare their key hardware components and subsidy eligibility, and inspect live hardware telemetry.
              </p>
            </div>

            {/* A. 3-Tab Architecture Selector: On-Grid / Hybrid / Off-Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {Object.values(SOLAR_TOPOLOGIES_DATA).map((topo) => {
                const isActive = activeTopologyTab === topo.id;
                return (
                  <button
                    key={topo.id}
                    type="button"
                    onClick={() => setActiveTopologyTab(topo.id as "on_grid" | "hybrid" | "off_grid")}
                    className={cn(
                      "p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5",
                      isActive
                        ? "bg-theme-surface border-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
                        : "bg-theme-surface/40 border-theme-border/70 hover:border-theme-border hover:bg-theme-surface"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-theme-primary leading-tight">
                        {topo.name}
                      </h3>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0",
                        isActive ? "border-emerald-500 bg-emerald-500 text-white" : "border-theme-border"
                      )}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-theme-secondary line-clamp-2 leading-snug">
                      {topo.tagline}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* B. Active Topology Deep-Dive Container (Minimal Unboxed Layout) */}
            {(() => {
              const activeTopology = SOLAR_TOPOLOGIES_DATA[activeTopologyTab] || SOLAR_TOPOLOGIES_DATA.on_grid;
              return (
                <div className="space-y-8 pt-2">
                  
                  {/* 1. Header & Summary */}
                  <div className="space-y-2 pb-6 border-b border-theme-border/60">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-theme-surface border border-theme-border text-xs font-semibold text-theme-primary">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{activeTopology.badge}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-theme-primary">
                      {activeTopology.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                      {activeTopology.shortDesc}
                    </p>
                  </div>

                  {/* 2. Step-by-Step Power Flow: How It Works */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-theme-primary tracking-tight">
                        {activeTopology.howItWorksTitle}
                      </h4>
                      <p className="text-xs sm:text-sm text-theme-secondary mt-1">
                        {activeTopology.howItWorksDesc}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 pt-1">
                      {activeTopology.flowSteps.map((step) => {
                        const IconComp = getTopologyStepIcon(step.icon);
                        return (
                          <div
                            key={step.step}
                            className="space-y-3"
                          >
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div className="space-y-1.5">
                              <h5 className="text-sm font-bold text-theme-primary leading-snug">
                                {step.title}
                              </h5>
                              <p className="text-xs text-theme-secondary leading-relaxed">
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Core Hardware Components & Switchgear */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-base sm:text-lg font-bold text-theme-primary tracking-tight">
                      Key Hardware &amp; Engineering Components
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 pt-1">
                      {activeTopology.components.map((comp, cIdx) => (
                        <div
                          key={cIdx}
                          className="space-y-1.5"
                        >
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                            {comp.role}
                          </span>
                          <h5 className="text-sm font-bold text-theme-primary leading-snug">
                            {comp.name}
                          </h5>
                          <p className="text-xs text-theme-secondary leading-relaxed">
                            {comp.specs}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Pros & Important Considerations (2-Column Minimal Matrix) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 pt-2">
                    {/* Advantages */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Key Advantages</span>
                      </div>
                      <ul className="space-y-2 text-xs text-theme-secondary">
                        {activeTopology.pros.map((pro, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Considerations */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-theme-primary font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-theme-muted" />
                        <span>Engineering Considerations</span>
                      </div>
                      <ul className="space-y-2 text-xs text-theme-secondary">
                        {activeTopology.cons.map((con, cIdx) => (
                          <li key={cIdx} className="flex items-start gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-theme-muted shrink-0 mt-1.5" />
                            <span className="leading-relaxed">{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 5. Ideal Property & Application Fit */}
                  <div className="rounded-3xl p-6 sm:p-8 bg-theme-surface border border-theme-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5 max-w-2xl">
                      <h4 className="text-lg sm:text-xl font-bold tracking-tight text-theme-primary">
                        Recommended Property Fit for {activeTopology.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                        {activeTopology.idealFor.join(" ")}
                      </p>
                    </div>

                    <Button
                      asChild
                      variant="gradient"
                      className="h-11 px-6 rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-md shadow-emerald-600/10 self-start md:self-center"
                    >
                      <a href="#packages" className="flex items-center gap-2">
                        <span>View Matching Packages</span>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </div>

                </div>
              );
            })()}

            {/* C. Direct Side-by-Side Comparison Matrix Table */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-bold text-theme-primary">
                  On-Grid vs. Hybrid vs. Off-Grid: Technical Comparison
                </h4>
                <p className="text-xs text-theme-secondary">
                  Evaluate grid connection, battery requirements, blackout behavior, and subsidy clearances side-by-side.
                </p>
              </div>

              {/* Rounded Bordered Table Container */}
              <div className="rounded-2xl border border-theme-border overflow-hidden bg-theme-surface/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-theme-border bg-theme-surface/80 text-theme-muted font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-[28%]">Parameter</th>
                        <th className="py-3.5 px-4 w-[24%] text-theme-primary font-bold">
                          ⚡ On-Grid Solar
                        </th>
                        <th className="py-3.5 px-4 w-[26%] text-emerald-700 dark:text-emerald-300 font-extrabold bg-gradient-to-b from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 border-x border-emerald-500/30">
                          <span>🌟 Hybrid (WayTara Flagship)</span>
                        </th>
                        <th className="py-3.5 px-4 w-[22%] text-theme-primary font-bold">
                          🔋 Off-Grid Solar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/60 text-theme-secondary">
                      {TOPOLOGY_COMPARISON_MATRIX.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-theme-surface/60 transition-colors group">
                          <td className="py-3.5 px-4 font-semibold text-theme-primary whitespace-nowrap">
                            {row.parameter}
                          </td>
                          <td className="py-3.5 px-4 leading-relaxed">
                            {row.onGrid}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-emerald-700 dark:text-emerald-300 bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.04] to-emerald-500/[0.08] dark:from-emerald-500/[0.14] dark:via-emerald-500/[0.08] dark:to-emerald-500/[0.14] border-x border-emerald-500/20 leading-relaxed">
                            {row.hybrid}
                          </td>
                          <td className="py-3.5 px-4 leading-relaxed">
                            {row.offGrid}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* D. Live Hardware Telemetry & Day/Night Mode Simulation */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-theme-border">
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-theme-primary">
                    Live Hardware Telemetry Simulation
                  </h3>
                  <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed max-w-2xl">
                    {powerFlowMode === "day"
                      ? "Daytime Mode: High-efficiency TOPCon bifacial solar directly powers loads while surplus energy fast-charges smart LFP battery banks and exports to the grid."
                      : "Night & Blackout Mode: Seamless sub-20ms instant battery discharge powers heavy ACs and appliances with zero flicker and complete grid independence."}
                  </p>
                </div>

                {/* Day / Night Segmented Toggle Switch */}
                <div className="inline-flex items-center p-1 rounded-2xl bg-theme-bg border border-theme-border shadow-inner shrink-0 select-none">
                  <button
                    type="button"
                    onClick={() => setPowerFlowMode("day")}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                      powerFlowMode === "day"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-theme-muted hover:text-theme-primary"
                    )}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Day Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPowerFlowMode("night")}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                      powerFlowMode === "night"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-theme-muted hover:text-theme-primary"
                    )}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Night Mode</span>
                  </button>
                </div>
              </div>

              {/* 4-Card Bento Grid with Dynamic Day/Night UI Mockup Illustrations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* BENTO CARD 1: GENERATION TIER (TOPCon Solar) */}
                <div className="rounded-3xl p-6 bg-theme-surface border border-theme-border/80 shadow-sm flex flex-col justify-between gap-5 hover:border-emerald-500/40 hover:shadow-md transition-all group">
                  {/* Visual UI Mockup Illustration Box (Coral/Amber Theme) */}
                  <div className="rounded-2xl p-5 bg-gradient-to-br from-orange-500/10 via-amber-500/[0.04] to-transparent border border-orange-500/20 min-h-[190px] flex flex-col justify-center gap-2.5 relative overflow-hidden">
                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border/70 shadow-sm flex items-center justify-between gap-2 backdrop-blur-sm">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center",
                          powerFlowMode === "day"
                            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                            : "bg-slate-500/10 text-slate-500 dark:text-slate-400"
                        )}>
                          <Sun className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-theme-primary">
                          {powerFlowMode === "day" ? "22.5%+ Bifacial Cell Efficiency" : "Solar Array: Standby State"}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        powerFlowMode === "day"
                          ? "text-orange-600 dark:text-orange-400 bg-orange-500/10"
                          : "text-slate-600 dark:text-slate-400 bg-slate-500/10"
                      )}>
                        {powerFlowMode === "day" ? "+15% Rear" : "0.0 kW"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border/70 shadow-sm flex items-center justify-between gap-2 backdrop-blur-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-theme-primary">
                          {powerFlowMode === "day" ? "Active Solar Yield: 8.2 kW Peak" : "Anti-PID & Reverse Flow Isolation"}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-theme-muted">
                        {powerFlowMode === "day" ? "Diffused Capture" : "100% Protected"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border/70 shadow-sm flex items-center justify-between gap-2 backdrop-blur-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-theme-primary">
                          {powerFlowMode === "day" ? "25-Yr Linear Power Guarantee" : "Zero Parasitic Night Draw"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {powerFlowMode === "day" ? "87.4% Yield" : "< 5W Standby"}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Content */}
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-theme-primary">
                      {activeData.hardwareArchitecture[0]?.title || "Tier-1 N-Type TOPCon Solar"}
                    </h3>
                    <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                      {activeData.hardwareArchitecture[0]?.description || "Dual-glass monocrystalline modules capturing diffused light even on overcast monsoon days."}
                    </p>
                  </div>
                </div>

                {/* BENTO CARD 2: STORAGE TIER (Smart LFP Storage) */}
                <div className="rounded-3xl p-6 bg-theme-surface border border-theme-border/80 shadow-sm flex flex-col justify-between gap-5 hover:border-emerald-500/40 hover:shadow-md transition-all group">
                  {/* Visual UI Mockup Illustration Box (Sky/Cyan Theme) */}
                  <div className="rounded-2xl p-5 bg-gradient-to-br from-cyan-500/10 via-blue-500/[0.04] to-transparent border border-cyan-500/20 min-h-[190px] flex flex-col justify-center gap-3 relative overflow-hidden">
                    <div className="p-4 rounded-xl bg-theme-surface/90 border border-theme-border/70 shadow-sm space-y-2.5 backdrop-blur-sm">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                          Smart LFP Wall Storage
                        </span>
                        <span className="text-[11px] font-semibold text-theme-muted">
                          {powerFlowMode === "day" ? "Charging @ +4.8 kW" : "Discharging @ -3.4 kW"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-medium text-theme-secondary">
                          <span>State of Charge (SoC)</span>
                          <strong className="text-theme-primary">
                            {powerFlowMode === "day" ? "94.2%" : "86.4%"}
                          </strong>
                        </div>
                        <div className="w-full h-2 rounded-full bg-theme-bg overflow-hidden border border-theme-border/60">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: powerFlowMode === "day" ? "94%" : "86%" }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-theme-border/50 text-[10px] text-theme-muted font-medium">
                        <span>{powerFlowMode === "day" ? "Temp: 27.4°C • Active BMS" : "Sub-20ms Backup Armed"}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {powerFlowMode === "day" ? "Cell Balancing Active" : "Zero Blackout Flicker"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Content */}
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-theme-primary">
                      {activeData.hardwareArchitecture[1]?.title || "Smart LFP Wall Storage"}
                    </h3>
                    <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                      {activeData.hardwareArchitecture[1]?.description || "Non-toxic, non-flammable prismatic cells with active balancing and real-time CANbus telemetry."}
                    </p>
                  </div>
                </div>

                {/* BENTO CARD 3: CONVERSION TIER (Hybrid Bi-Directional PCS) */}
                <div className="rounded-3xl p-6 bg-theme-surface border border-theme-border/80 shadow-sm flex flex-col justify-between gap-5 hover:border-emerald-500/40 hover:shadow-md transition-all group">
                  {/* Visual UI Mockup Illustration Box (Emerald/Mint Theme) */}
                  <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500/10 via-teal-500/[0.04] to-transparent border border-emerald-500/20 min-h-[190px] flex flex-col justify-center gap-3 relative overflow-hidden">
                    <div className="p-4 rounded-xl bg-theme-surface/90 border border-theme-border/70 shadow-sm space-y-3 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-theme-primary">
                          {powerFlowMode === "day" ? "Solar Direct & Charge Mode" : "Battery Inversion Mode"}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          &lt; 20ms UPS
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-center font-medium">
                        <div className="p-1.5 rounded-lg bg-theme-bg border border-theme-border/70 text-[10px]">
                          <span className="text-theme-muted block">SUN</span>
                          <strong className={powerFlowMode === "day" ? "text-emerald-500" : "text-slate-400"}>
                            {powerFlowMode === "day" ? "8.2 kW" : "0.0 kW"}
                          </strong>
                        </div>
                        <div className="p-1.5 rounded-lg bg-theme-bg border border-theme-border/70 text-[10px]">
                          <span className="text-theme-muted block">LOAD</span>
                          <strong className="text-theme-primary">3.4 kW</strong>
                        </div>
                        <div className="p-1.5 rounded-lg bg-theme-bg border border-theme-border/70 text-[10px]">
                          <span className="text-theme-muted block">BESS</span>
                          <strong className="text-cyan-500">
                            {powerFlowMode === "day" ? "+4.8 kW" : "-3.4 kW"}
                          </strong>
                        </div>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px]">
                          <span className="text-emerald-700 dark:text-emerald-300 block">
                            {powerFlowMode === "day" ? "EFF" : "UPS"}
                          </span>
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {powerFlowMode === "day" ? "98.4%" : "< 20ms"}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-theme-secondary pt-1 border-t border-theme-border/50">
                        <span>Pure Sine Wave: 230V / 50Hz</span>
                        <span className="font-semibold text-theme-primary">
                          {powerFlowMode === "day" ? "DISCOM Net-Meter Synced" : "ACs & Heavy Appliances Powered"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Content */}
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-theme-primary">
                      {activeData.hardwareArchitecture[2]?.title || "Hybrid Bi-Directional PCS"}
                    </h3>
                    <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                      {activeData.hardwareArchitecture[2]?.description || "Intelligent inverter managing solar generation, battery storage, and grid net-metering synchronization automatically."}
                    </p>
                  </div>
                </div>

                {/* BENTO CARD 4: CLOUD IOT & REMOTE DASHBOARD */}
                <div className="rounded-3xl p-6 bg-theme-surface border border-theme-border/80 shadow-sm flex flex-col justify-between gap-5 hover:border-emerald-500/40 hover:shadow-md transition-all group">
                  {/* Visual UI Mockup Illustration Box (Violet/Indigo Theme) */}
                  <div className="rounded-2xl p-5 bg-gradient-to-br from-indigo-500/10 via-purple-500/[0.04] to-transparent border border-indigo-500/20 min-h-[190px] flex flex-col justify-center gap-2.5 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        WayTara Live Dashboard
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Worldwide Access
                      </span>
                    </div>

                    {/* Mock Real-Time Energy & Inverter Management Widget */}
                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border/70 shadow-sm space-y-1.5 backdrop-blur-sm">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-theme-muted font-medium">
                          {powerFlowMode === "day" ? "Today's Solar: " : "Night Battery Draw: "}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {powerFlowMode === "day" ? "38.4 kWh" : "16.8 kWh"}
                          </strong>
                        </span>
                        <span className="text-theme-secondary font-medium">
                          {powerFlowMode === "day" ? "Home Load: " : "Grid Draw: "}
                          <strong className="text-theme-primary">
                            {powerFlowMode === "day" ? "14.8 kWh" : "0.0 kWh (Saved ₹184)"}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-theme-border/50 text-[10px]">
                        <span className="text-theme-muted flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Inverter Remote Control: {powerFlowMode === "day" ? "Solar Self-Consumption" : "Battery Discharge"}
                        </span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Live Telemetry</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] px-1 text-theme-muted">
                      <span>{powerFlowMode === "day" ? "365-Day Historical Analytics" : "Zero Blackout Interruption"}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">100% Cloud Uptime</span>
                    </div>
                  </div>

                  {/* Bottom Content */}
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-theme-primary">
                      {activeData.hardwareArchitecture[3]?.title || "WayTara Cloud IoT & Remote Dashboard"}
                    </h3>
                    <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                      {activeData.hardwareArchitecture[3]?.description || "Real-time mobile and web dashboard to monitor daily solar generation, track historical energy metrics, and remotely manage inverter operating modes anytime, from anywhere in the world."}
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </section>

          {/* SECTION 2: COMPARATIVE ENGINEERING MATRIX (WHY WAYTARA STYLE WITH SIMULTANEOUS COMPARISON) */}
          <section id="comparison" className="scroll-mt-24 space-y-6">
            
            {/* Header */}
            <div className="space-y-2 pb-2 border-b border-theme-border">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
                2. Comparative Engineering Analysis
              </h2>
              <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed max-w-2xl">
                Review how WayTara&apos;s pre-engineered unified topology eliminates voltage clipping, multi-vendor finger pointing, and switchover lag found in traditional installations.
              </p>
            </div>

            {/* 3 Comparison Pillars with Integrated WayTara Solution & Traditional Contrast */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 pt-2">
              {activeData.challenges.map((c, idx) => {
                const titles = [
                  "Instant Sub-20ms Blackout Resilience",
                  "Maximum Solar Tariff Optimization",
                  "Single Accountable Warranty SLA",
                ];

                const icons = [Zap, TrendingDown, ShieldCheck];
                const Icon = icons[idx] || ShieldCheck;

                return (
                  <div
                    key={idx}
                    className="flex flex-col justify-between text-left group space-y-4"
                  >
                    {/* Top: WayTara Solution */}
                    <div className="space-y-2.5">
                      {/* Circular Icon Badge */}
                      <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3 bg-theme-surface border border-theme-border text-theme-primary group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30 shadow-sm transition-all duration-300 group-hover:scale-110 shrink-0">
                        <Icon className="w-5 h-5 stroke-[1.8]" />
                      </div>

                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {titles[idx]}
                      </h3>

                      {/* WayTara Solution Description */}
                      <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal">
                        {c.waytaraSolution}
                      </p>
                    </div>

                    {/* Bottom: Traditional Multi-Vendor Pitfall (Directly visible) */}
                    <div className="pt-3 border-t border-theme-border/70 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Traditional Multi-Vendor Pitfall</span>
                      </span>
                      <p className="text-xs text-theme-muted leading-relaxed">
                        {c.traditionalPain}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 3: TURNKEY CAPACITY PACKAGES (SELECTABLE PLAN CARDS & DETAIL VIEW) */}
          <section id="packages" className="scroll-mt-24 space-y-6">
            <div className="space-y-2 pb-2 border-b border-theme-border">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
                3. Turnkey Capacity Packages
              </h2>
              <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed max-w-2xl">
                Standardized blueprints pre-calibrated for rapid site installation, DISCOM net-metering approvals, and guaranteed generation yields. Select a blueprint to view specifications.
              </p>
            </div>

            {/* Top Row: 3 Selectable Plan Cards matching reference image */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {activeData.packages.map((pkg, idx) => {
                const isSelected = selectedPackageIndex === idx;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackageIndex(idx)}
                    className={cn(
                      "rounded-3xl p-6 sm:p-7 text-left transition-all duration-300 cursor-pointer relative flex flex-col justify-between gap-5 group",
                      isSelected
                        ? "bg-theme-surface border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-theme-surface border border-theme-border/80 hover:border-theme-border shadow-sm hover:shadow-md"
                    )}
                  >
                    {/* Top Row: Badge / Tag + Radio Indicator Dot */}
                    <div className="flex items-center justify-between gap-2 w-full min-h-[26px]">
                      <span className="text-[10px] sm:text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
                        {pkg.badge}
                      </span>

                      {/* Radio Circle Indicator matching image */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0",
                          isSelected
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-theme-border bg-transparent group-hover:border-theme-muted"
                        )}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Plan Name & Description */}
                    <div className="space-y-1.5 w-full">
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
                        {pkg.name}
                      </h3>

                      <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed font-normal">
                        {pkg.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Package Detailed Blueprint Specifications & Actions */}
            {(() => {
              const activePkg = activeData.packages[selectedPackageIndex] || activeData.packages[0];
              return (
                <div className="rounded-3xl p-6 sm:p-8 bg-theme-surface border border-theme-border/90 shadow-sm space-y-6 animate-in fade-in duration-300">
                  
                  {/* Header info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-theme-border/70">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Selected Blueprint Specifications
                        </span>
                        <span className="text-theme-muted">•</span>
                        <span className="text-xs text-theme-muted font-medium">{activePkg.badge}</span>
                      </div>
                      <h4 className="text-xl sm:text-2xl font-bold text-theme-primary">
                        {activePkg.name} Hardware &amp; Engineering Blueprint
                      </h4>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xl sm:text-2xl font-extrabold text-theme-primary block">
                        {activePkg.priceRange}
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Estimated Payback: {activePkg.payback}
                      </span>
                    </div>
                  </div>

                  {/* 3 Key Specs Grid with Icons Above Titles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="p-4 sm:p-5 rounded-2xl bg-theme-bg border border-theme-border/70 space-y-1">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                        <Sun className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-medium text-theme-muted block">Solar Array</span>
                      <div className="text-base sm:text-lg font-bold text-theme-primary">{activePkg.solarKw}</div>
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-theme-bg border border-theme-border/70 space-y-1">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2">
                        <BatteryCharging className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-medium text-theme-muted block">Battery Storage</span>
                      <div className="text-base sm:text-lg font-bold text-theme-primary">{activePkg.batteryKwh}</div>
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-theme-bg border border-theme-border/70 space-y-1">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-medium text-theme-muted block">Inverter Topology</span>
                      <div className="text-base sm:text-lg font-bold text-theme-primary truncate">{activePkg.inverterSurge}</div>
                    </div>
                  </div>

                  {/* Features & Inclusions Checklist */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
                      What&apos;s Included in {activePkg.name}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activePkg.features.map((feat, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-theme-secondary leading-relaxed"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="pt-5 border-t border-theme-border/70 flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <p className="text-xs text-theme-muted">
                      Need custom capacity or multi-roof layout? We provide customized single-line diagrams.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto shrink-0">
                      <Button
                        asChild
                        variant="outline"
                        className="h-10 px-5 rounded-xl text-xs font-semibold justify-center cursor-pointer border-theme-border hover:border-emerald-500/40"
                      >
                        <Link href={`/?for=${activeSegmentId}#energy-planner`}>
                          <span>Configure in Energy Planner</span>
                        </Link>
                      </Button>

                      <Button
                        variant="gradient"
                        onClick={() => setAssessmentModalOpen(true)}
                        className="h-10 px-6 rounded-xl text-xs font-semibold justify-center cursor-pointer shadow-md shadow-emerald-600/10"
                      >
                        <span>Get Quote for {activePkg.name}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </div>

                </div>
              );
            })()}
          </section>

          {/* SECTION 4: FINANCIAL ECONOMICS & LCOE (INNOVATIVE VISUAL TARIFF ARBITRAGE & LIFECYCLE ROADMAP) */}
          <section id="financials" className="scroll-mt-24 space-y-10">
            
            {/* Header */}
            <div className="space-y-2 pb-2 border-b border-theme-border">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
                4. Financial Economics &amp; LCOE Model
              </h2>
              <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed max-w-2xl">
                Real-world electricity cost comparison, turnkey EPC economics, and 25-year lifecycle investment roadmap with guaranteed government subsidy clearance.
              </p>
            </div>

            {/* PART 1: SYSTEM INVESTMENT, PAYBACK & CENTRAL SUBSIDY TIERS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Estimated Payback */}
              <div className="p-4 sm:p-5 rounded-2xl bg-theme-surface border border-theme-border/70 space-y-1">
                <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
                  Estimated Payback
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  2.8 – 3.5 Years
                </div>
                <p className="text-[11px] text-theme-secondary leading-snug">
                  100% capital break-even through continuous monthly DISCOM net-metering offsets.
                </p>
              </div>

              {/* 2. Typical System Investment */}
              <div className="p-4 sm:p-5 rounded-2xl bg-theme-surface border border-theme-border/70 space-y-1">
                <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
                  System Investment
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-theme-primary">
                  ₹1.95L – ₹3.6L
                </div>
                <p className="text-[11px] text-theme-secondary leading-snug">
                  Turnkey EPC for 3 kW – 6 kWp rooftop capacity including structures, inverters &amp; commissioning.
                </p>
              </div>

              {/* 3. PM Surya Ghar Subsidy */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-1">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                  PM Surya Ghar Subsidy
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  Up to ₹78,000
                </div>
                <p className="text-[11px] text-theme-secondary leading-snug">
                  Eligible for full Central PM Surya Ghar subsidies (₹30,000 for 1kW, ₹60,000 for 2kW, ₹78,000 for 3kW+).
                </p>
              </div>
            </div>

            {/* PART 2: VISUAL COST-PER-UNIT TARIFF COMPARISON BARS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-theme-primary">
                  Cost per Unit Comparison (Levelized LCOE)
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Solar saves up to 78% per unit
                </span>
              </div>

              {/* Visual Horizontal Comparison Bars */}
              <div className="space-y-3 pt-1">
                {/* 1. WayTara Solar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      WayTara Clean Solar (25-Yr Fixed)
                    </span>
                    <strong className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                      {activeData.financialModel.lcoeComparison.solarKwh} / kWh
                    </strong>
                  </div>
                  <div className="w-full h-3 rounded-full bg-theme-border/30 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full w-[22%]" />
                  </div>
                </div>

                {/* 2. DISCOM Grid Power */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-medium text-theme-secondary flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      DISCOM Grid Power (Current Tariff Slab)
                    </span>
                    <strong className="text-base sm:text-lg font-bold text-theme-primary">
                      {activeData.financialModel.lcoeComparison.gridKwh} / kWh
                    </strong>
                  </div>
                  <div className="w-full h-3 rounded-full bg-theme-border/30 overflow-hidden">
                    <div className="h-full bg-slate-400 dark:bg-slate-500 rounded-full w-[55%]" />
                  </div>
                </div>

                {/* 3. Diesel Generator */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-medium text-theme-secondary flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      Diesel Generator Backup (Fuel &amp; Maintenance)
                    </span>
                    <strong className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400">
                      {activeData.financialModel.lcoeComparison.dieselKwh} / kWh
                    </strong>
                  </div>
                  <div className="w-full h-3 rounded-full bg-theme-border/30 overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full w-[100%]" />
                  </div>
                </div>
              </div>

              {/* Insightful Bottom Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/[0.05] dark:bg-emerald-500/10 border border-emerald-500/20 text-xs text-theme-secondary flex items-center justify-between flex-wrap gap-2">
                <span>💡 <strong>Real Impact:</strong> Generating solar at {activeData.financialModel.lcoeComparison.solarKwh}/unit saves ~₹7,400 every month for every 1,000 units consumed.</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">0% Inflation Risk</span>
              </div>
            </div>

            {/* PART 2: 3-MILESTONE 25-YEAR FINANCIAL RETURN ROADMAP */}
            <div className="space-y-6 pt-4 border-t border-theme-border/70">
              <div>
                <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
                  The 25-Year Investment Journey
                </span>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-theme-primary mt-1">
                  How your capital turns into lifetime returns
                </h3>
              </div>

              {/* Connected Milestone Process Flow */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 relative">
                
                {/* Milestone 1 */}
                <div className="space-y-3 text-left relative">
                  {/* Top Progress Line with Step Node */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                      01
                    </div>
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-500 to-emerald-500/20 rounded-full" />
                    <span className="text-xs font-semibold text-theme-muted">Day 1</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                      Up to ₹78,000
                    </div>
                    <h4 className="text-sm font-bold text-theme-primary">
                      Government Subsidy Direct Credit
                    </h4>
                    <p className="text-xs text-theme-secondary leading-relaxed font-normal pt-1">
                      Direct central PM Surya Ghar DBT transfer credited to your bank account. 100% documentation and DISCOM net-meter inspection handled by WayTara.
                    </p>
                  </div>
                </div>

                {/* Milestone 2 */}
                <div className="space-y-3 text-left relative">
                  {/* Top Progress Line with Step Node */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-theme-bg border-2 border-theme-border text-theme-primary text-xs font-bold flex items-center justify-center shrink-0">
                      02
                    </div>
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-theme-border to-theme-border/20 rounded-full" />
                    <span className="text-xs font-semibold text-theme-muted">Years 3 – 4</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="text-3xl sm:text-4xl font-extrabold text-theme-primary tracking-tight">
                      100% Payback
                    </div>
                    <h4 className="text-sm font-bold text-theme-primary">
                      Complete Capital Break-Even
                    </h4>
                    <p className="text-xs text-theme-secondary leading-relaxed font-normal pt-1">
                      Cumulative monthly DISCOM electricity bill offsets fully recover 100% of your turnkey EPC capital investment.
                    </p>
                  </div>
                </div>

                {/* Milestone 3 */}
                <div className="space-y-3 text-left relative">
                  {/* Top Progress Line with Step Node */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                      03
                    </div>
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-500 to-emerald-500/20 rounded-full" />
                    <span className="text-xs font-semibold text-theme-muted">Years 5 – 25</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                      ₹28L – ₹55L
                    </div>
                    <h4 className="text-sm font-bold text-theme-primary">
                      21+ Years of Free Power (24.5% IRR)
                    </h4>
                    <p className="text-xs text-theme-secondary leading-relaxed font-normal pt-1">
                      Delivers over two decades of zero power bills and inflation immunity, vastly outperforming fixed deposits and mutual funds.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* PART 3: SUBTLE POLICY NOTE */}
            <div className="pt-4 border-t border-theme-border/70 flex items-start gap-2.5 text-xs text-theme-secondary">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-theme-primary font-semibold mr-1">
                  Policy &amp; Subsidy Assistance:
                </strong>
                {activeData.financialModel.subsidyOrTaxNote}
              </p>
            </div>

          </section>

          {/* SECTION 5: FREQUENTLY ASKED QUESTIONS */}
          <section id="faqs" className="scroll-mt-24 space-y-6">
            <div className="space-y-2 pb-2 border-b border-theme-border">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
                  5. Frequently Asked Questions
                </h2>
                <span className="text-xs text-theme-muted">
                  8 Core Architectural &amp; Subsidy Answers
                </span>
              </div>
              <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed max-w-2xl">
                Consolidated engineering, pricing, battery sizing, AC compatibility, and PM Surya Ghar subsidy answers for On-Grid, Hybrid, and Off-Grid solar systems.
              </p>
            </div>

            <div className="space-y-2.5">
              {SOLAR_TOPOLOGY_CONSOLIDATED_FAQS.map((faq, fIdx) => {
                const isOpen = openFaqIndex === fIdx;
                return (
                  <div
                    key={fIdx}
                    className="rounded-2xl bg-theme-surface border border-theme-border/80 overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : fIdx)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-theme-primary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <span className="leading-snug">{faq.question}</span>
                      <div className="w-6 h-6 rounded-full bg-theme-bg border border-theme-border flex items-center justify-center shrink-0">
                        {isOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-theme-muted" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-theme-secondary leading-relaxed border-t border-theme-border/50 pt-3 animate-in fade-in duration-200">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 6: ENGINEERING CONSULTATION & BOOKING */}
          <section id="consultation" className="scroll-mt-24 space-y-6">
            <div className="space-y-2 pb-2 border-b border-theme-border">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
                6. Engineering Consultation &amp; Next Steps
              </h2>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl bg-theme-surface border border-theme-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="max-w-xl space-y-1.5 text-center md:text-left">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
                  Book an On-Site Engineering Study for {activeData.name}
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                  A certified WayTara Power Systems Engineer will conduct shadow mapping, structural inspection, and single-line diagram formulation for your property.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => setAssessmentModalOpen(true)}
                  className="h-11 px-6 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  <span>Book Site Assessment</span>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-11 px-5 text-xs font-semibold rounded-xl border-theme-border cursor-pointer hover:border-emerald-500/40"
                >
                  <Link href={`/?for=${activeSegmentId}#energy-planner`}>
                    <Sparkles className="w-4 h-4 mr-2 text-emerald-500" />
                    <span>Plan with Tara AI</span>
                  </Link>
                </Button>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* Assessment Modal */}
      <AssessmentModal
        open={assessmentModalOpen}
        onOpenChange={setAssessmentModalOpen}
        preselectedSegment={
          activeSegmentId === "factory" || activeSegmentId === "it_park"
            ? "commercial"
            : (activeSegmentId as any)
        }
      />
    </div>
  );
}
