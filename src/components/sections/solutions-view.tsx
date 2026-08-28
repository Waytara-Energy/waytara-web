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
} from "lucide-react";
import {
  SEGMENT_SOLUTIONS_DATA,
  SEGMENT_KEYS,
  SegmentSolutionData,
  normalizeSegmentSlug,
} from "@/data/solutions-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal, StaggerContainer } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";
import { AssessmentModal } from "./assessment-modal";

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

export function SolutionsView({ initialSegment = "home" }: SolutionsViewProps) {
  const router = useRouter();
  const normalizedInitial = normalizeSegmentSlug(initialSegment);
  const [activeSegmentId, setActiveSegmentId] = React.useState<string>(normalizedInitial);
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);
  const [assessmentModalOpen, setAssessmentModalOpen] = React.useState(false);

  // Sync state if initialSegment prop changes
  React.useEffect(() => {
    const norm = normalizeSegmentSlug(initialSegment);
    setActiveSegmentId(norm);
  }, [initialSegment]);

  const activeData: SegmentSolutionData =
    SEGMENT_SOLUTIONS_DATA[activeSegmentId] || SEGMENT_SOLUTIONS_DATA.home;

  const handleSelectSegment = (tabId: string, path: string) => {
    setActiveSegmentId(tabId);
    setOpenFaqIndex(0);
    // Smooth URL update without full reload
    window.history.pushState(null, "", path);
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

  return (
    <div className="space-y-12 sm:space-y-16 pb-20">
      
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
      {/* 01. EXECUTIVE BRIEFING & CORE BENCHMARKS SPECIFICATION SHEET */}
      {/* ========================================================================= */}
      <div className="rounded-3xl bg-theme-surface border border-theme-border shadow-sm overflow-hidden">
        {/* Document Header Metadata Bar */}
        <div className="px-6 sm:px-8 py-3.5 bg-theme-bg/60 border-b border-theme-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono text-[11px] text-theme-muted uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>SPEC SHEET REF: WT-ENG-{activeData.id.toUpperCase().replace("-", "_")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-theme-secondary bg-theme-surface px-2.5 py-1 rounded-md border border-theme-border">
              {activeData.category}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Verified Topology
            </span>
          </div>
        </div>

        {/* Main Briefing Grid: Left Content + Right Image */}
        <div className="p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Executive Blueprint Overview
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-theme-primary leading-tight">
                {activeData.tagline}
              </h2>
            </div>

            <p className="text-sm sm:text-base text-theme-secondary leading-relaxed pt-1">
              {activeData.executiveSummary}
            </p>

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="gradient"
                size="sm"
                onClick={() => setAssessmentModalOpen(true)}
                className="h-10 px-5 text-xs font-semibold rounded-xl cursor-pointer"
              >
                <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                <span>Book Site Feasibility Study</span>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-10 px-4 text-xs font-semibold rounded-xl border-theme-border cursor-pointer hover:border-emerald-500/40"
              >
                <Link href={`/?for=${activeSegmentId}#energy-planner`}>
                  <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                  <span>Configure with AI Planner</span>
                </Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden aspect-[16/11] border border-theme-border/80 shadow-sm group">
              <Image
                src={activeData.heroImage}
                alt={activeData.name}
                fill
                unoptimized
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/20 inline-block">
                  {activeData.name} System Profile
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Column Key Performance Benchmarks */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-theme-border divide-y sm:divide-y-0 sm:divide-x divide-theme-border/70 bg-theme-bg/30">
          {activeData.metrics.map((m, idx) => {
            const Icon = getMetricIcon(m.icon);
            return (
              <div key={idx} className="p-5 sm:p-6 flex flex-col justify-between gap-1.5">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-theme-muted uppercase tracking-wider">
                  <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{m.label}</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-theme-primary tracking-tight">
                    {m.value}{" "}
                    <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {m.unit}
                    </span>
                  </div>
                  <div className="text-[11px] text-theme-muted mt-0.5 leading-snug">
                    {m.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 02. SYSTEM HARDWARE TOPOLOGY SPECIFICATION */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-theme-border">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <span>02 / HARDWARE ARCHITECTURE</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
              4-Tier Integrated System Topology
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-theme-secondary max-w-md">
            All 4 tiers interlock seamlessly under one unified warranty SLA with CAN-bus telemetry.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeData.hardwareArchitecture.map((hw, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-5 bg-theme-surface border border-theme-border/80 flex flex-col justify-between hover:border-emerald-500/40 hover:shadow-sm transition-all duration-200"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-theme-muted uppercase tracking-wider">
                    TIER 0{idx + 1}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    {hw.tag}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-theme-primary">
                    {hw.title}
                  </h4>
                  <p className="text-xs text-theme-secondary leading-relaxed mt-1.5">
                    {hw.description}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-theme-bg/80 border border-theme-border/70 space-y-1.5 mt-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-theme-muted block">
                    Core Specifications
                  </span>
                  {hw.specs.map((spec, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-start gap-1.5 text-xs text-theme-primary font-medium"
                    >
                      <span className="text-emerald-500 font-bold leading-none mt-0.5">•</span>
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 03. COMPARATIVE ARCHITECTURAL MATRIX */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-theme-border">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <span>03 / COMPARATIVE ANALYSIS</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
              Fragmented Sourcing vs. WayTara Integrated Architecture
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-theme-secondary max-w-md">
            Direct comparison showing operational reliability differences for {activeData.name.toLowerCase()}.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {activeData.challenges.map((c, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-5 bg-theme-surface border border-theme-border/80 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                {/* Traditional Pain */}
                <div className="p-3.5 rounded-xl bg-theme-bg border border-theme-border space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Traditional Sourcing</span>
                  </div>
                  <p className="text-xs text-theme-secondary leading-relaxed pt-0.5">
                    {c.traditionalPain}
                  </p>
                </div>

                {/* WayTara Solution */}
                <div className="p-3.5 rounded-xl bg-emerald-500/[0.05] dark:bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>WayTara Integrated System</span>
                  </div>
                  <p className="text-xs text-theme-primary font-medium leading-relaxed pt-0.5">
                    {c.waytaraSolution}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 04. STANDARD TURNKEY CAPACITY PACKAGES */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-theme-border">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <span>04 / STANDARD CAPACITY PACKAGES</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
              Pre-Engineered Packages for {activeData.name}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-theme-secondary max-w-md">
            Standardized blueprints with DISCOM approval assistance and turnkey installation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activeData.packages.map((pkg) => (
            <div
              key={pkg.id}
              className={cn(
                "rounded-2xl p-6 bg-theme-surface border flex flex-col justify-between gap-6 transition-all duration-200 relative",
                pkg.isPopular
                  ? "border-emerald-600/80 dark:border-emerald-500/70 shadow-sm ring-1 ring-emerald-500/20"
                  : "border-theme-border/80 shadow-sm hover:border-theme-border"
              )}
            >
              {pkg.isPopular && (
                <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white text-[10px] font-bold tracking-wider uppercase shadow-sm flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Recommended Blueprint</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 inline-block mb-2">
                    {pkg.badge}
                  </span>
                  <h4 className="text-xl font-bold text-theme-primary">{pkg.name}</h4>
                  <p className="text-xs text-theme-secondary mt-1 leading-snug">{pkg.tagline}</p>
                </div>

                {/* Specs Table */}
                <div className="p-3.5 rounded-xl bg-theme-bg/80 border border-theme-border/70 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted font-medium">Solar Array</span>
                    <strong className="text-theme-primary font-bold">{pkg.solarKw}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted font-medium">Storage Capacity</span>
                    <strong className="text-theme-primary font-bold">{pkg.batteryKwh}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted font-medium">Inverter / Surge</span>
                    <strong className="text-theme-primary font-bold">{pkg.inverterSurge}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-theme-border/60">
                    <span className="text-theme-muted font-medium">Est. Payback</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{pkg.payback}</strong>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-1.5 pt-1">
                  {pkg.features.map((feat, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-start gap-2 text-xs text-theme-secondary leading-snug"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price & Actions */}
              <div className="pt-4 border-t border-theme-border/60 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-theme-muted">Estimated Investment</span>
                  <span className="text-base font-bold text-theme-primary">{pkg.priceRange}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="text-xs h-9 rounded-xl justify-center font-semibold cursor-pointer border-theme-border"
                  >
                    <Link href={`/?for=${activeSegmentId}#energy-planner`}>
                      <span>Configure</span>
                    </Link>
                  </Button>
                  <Button
                    variant="gradient"
                    onClick={() => setAssessmentModalOpen(true)}
                    className="text-xs h-9 rounded-xl justify-center font-semibold cursor-pointer"
                  >
                    <span>Get Quote</span>
                    <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 05. FINANCIAL MODEL & LEVELIZED COST ANALYSIS */}
      {/* ========================================================================= */}
      <div className="rounded-3xl p-6 sm:p-8 bg-theme-surface border border-theme-border shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-theme-border">
          <div className="max-w-xl space-y-2">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              <span>05 / FINANCIAL ENGINEERING</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
              {activeData.financialModel.title}
            </h3>
            <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
              {activeData.financialModel.description}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/[0.06] dark:bg-emerald-500/10 border border-emerald-500/20 max-w-md">
            <div className="flex items-start gap-2.5 text-xs text-theme-primary">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-theme-primary font-semibold mb-0.5">
                  Policy &amp; Tax Incentive Note
                </strong>
                <span className="text-theme-secondary leading-snug block text-[11px]">
                  {activeData.financialModel.subsidyOrTaxNote}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Financial Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {activeData.financialModel.metrics.map((fm, idx) => (
            <div
              key={idx}
              className={cn(
                "p-4 rounded-xl border flex flex-col justify-between gap-2",
                fm.highlight
                  ? "bg-emerald-500/[0.06] border-emerald-500/30"
                  : "bg-theme-bg/70 border-theme-border/70"
              )}
            >
              <span className="text-[11px] text-theme-muted font-medium">{fm.label}</span>
              <div>
                <div
                  className={cn(
                    "text-xl sm:text-2xl font-bold tracking-tight",
                    fm.highlight
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-theme-primary"
                  )}
                >
                  {fm.value}
                </div>
                <div className="text-[10px] text-theme-muted mt-0.5 leading-snug">
                  {fm.sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* LCOE Cost Comparison Strip */}
        <div className="p-4 sm:p-5 rounded-2xl bg-theme-bg border border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-theme-primary uppercase tracking-wider">
              Levelized Cost per Unit (LCOE Comparison)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-theme-muted">WayTara Solar:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                {activeData.financialModel.lcoeComparison.solarKwh} / kWh
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="text-theme-muted">DISCOM Grid:</span>
              <strong className="text-theme-primary font-bold text-sm">
                {activeData.financialModel.lcoeComparison.gridKwh} / kWh
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-theme-muted">Diesel Generator:</span>
              <strong className="text-theme-primary font-bold text-sm">
                {activeData.financialModel.lcoeComparison.dieselKwh} / kWh
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 06. VERIFIED FIELD DEPLOYMENT AUDIT */}
      {/* ========================================================================= */}
      <div className="rounded-3xl bg-theme-surface border border-theme-border shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-theme-border">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <FileCheck className="w-4 h-4" />
            <span>06 / VERIFIED CASE STUDY</span>
          </div>
          <span className="text-xs text-theme-muted font-medium bg-theme-bg px-2.5 py-1 rounded-md border border-theme-border">
            {activeData.caseStudy.location}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary leading-snug">
              {activeData.caseStudy.title}
            </h3>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              System Size &amp; Topology: {activeData.caseStudy.systemSize}
            </p>

            <blockquote className="text-xs sm:text-sm text-theme-secondary italic leading-relaxed border-l-2 border-emerald-500 pl-3.5 py-1">
              &ldquo;{activeData.caseStudy.quote}&rdquo;
            </blockquote>

            <div className="text-xs font-semibold text-theme-primary pt-1">
              — {activeData.caseStudy.author}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-theme-bg border border-theme-border space-y-1">
              <span className="text-[11px] text-theme-muted">Monthly Bill (Before)</span>
              <div className="text-base font-bold text-red-600 dark:text-red-400">{activeData.caseStudy.monthlyBillBefore}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 space-y-1">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">Monthly Bill (After)</span>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{activeData.caseStudy.monthlyBillAfter}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-theme-bg border border-theme-border space-y-1">
              <span className="text-[11px] text-theme-muted">Annual Net Savings</span>
              <div className="text-base font-bold text-theme-primary">{activeData.caseStudy.annualSavings}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-theme-bg border border-theme-border space-y-1">
              <span className="text-[11px] text-theme-muted">CO₂ Abatement / Yr</span>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{activeData.caseStudy.co2Offset}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 07. TECHNICAL FAQS ACCORDION */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-theme-border">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <span>07 / TECHNICAL ADVISORY</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
              Frequently Asked Questions for {activeData.name}
            </h3>
          </div>
        </div>

        <div className="space-y-2.5">
          {activeData.faqs.map((faq, fIdx) => {
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
                  <span>{faq.question}</span>
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
      </div>

      {/* ========================================================================= */}
      {/* 08. ACTION & ENGINEERING FEASIBILITY CTA */}
      {/* ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-theme-surface border border-theme-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-xl space-y-1.5 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <span>08 / NEXT STEPS</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-primary">
            Ready to design your {activeData.name} infrastructure?
          </h3>
          <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
            Schedule an on-site shadow &amp; structural engineering study, or simulate 25-year financial savings with Tara AI.
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
            <span>Book Engineering Assessment</span>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-11 px-5 text-xs font-semibold rounded-xl border-theme-border cursor-pointer hover:border-emerald-500/40"
          >
            <Link href={`/?for=${activeSegmentId}#energy-planner`}>
              <Zap className="w-4 h-4 mr-2 text-emerald-500" />
              <span>Launch AI Sizing Tool</span>
            </Link>
          </Button>
        </div>
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
