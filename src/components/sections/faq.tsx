"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Sun,
  Cpu,
  Coins,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FAQ_DATA, FaqCategoryType } from "@/data/faq";
import { CustomerSegmentId } from "@/types";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/shared/reveal";

interface FaqProps {
  selectedSegment?: CustomerSegmentId;
}

interface SidebarCategory {
  id: FaqCategoryType;
  title: string;
  description: string;
  icon: React.ElementType;
}

const FAQ_SIDEBAR_CATEGORIES: SidebarCategory[] = [
  {
    id: "solar_battery",
    title: "Solar, Battery & Storage",
    description:
      "Learn about N-type TOPCon panels, rooftop space, Smart LFP battery lifespans, and blackout backup for ACs & pumps.",
    icon: Sun,
  },
  {
    id: "software_hardware",
    title: "Software & Hardware",
    description:
      "Understand Tier-1 certified equipment, Tara AI telemetry, mobile app controls, and our 25-year warranty SLA.",
    icon: Cpu,
  },
  {
    id: "money_roi",
    title: "Money & ROI",
    description:
      "Explore payback timelines, central PM Surya Ghar subsidies, commercial tax depreciation, and zero-down financing.",
    icon: Coins,
  },
];

export function FAQ({ selectedSegment }: FaqProps) {
  const [activeCategory, setActiveCategory] = React.useState<FaqCategoryType>("solar_battery");
  const [openFaqId, setOpenFaqId] = React.useState<string | null>("sb-1");

  React.useEffect(() => {
    if (selectedSegment === "ev_fleet") {
      setActiveCategory("software_hardware");
    } else if (selectedSegment === "commercial") {
      setActiveCategory("money_roi");
    }
  }, [selectedSegment]);

  const currentCategory =
    FAQ_SIDEBAR_CATEGORIES.find((cat) => cat.id === activeCategory) ||
    FAQ_SIDEBAR_CATEGORIES[0];

  const filteredFaqs = React.useMemo(() => {
    return FAQ_DATA.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const toggleFaq = (id: string) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="faq"
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden"
    >
      <div className="fluid-container">
        
        {/* 1. Top Pill Badge */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                FAQs ?
              </span>
            </div>
          </div>
        </Reveal>

        {/* 2. Top Header */}
        <Reveal direction="up" delay={120} duration={700}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-14">
            
            {/* Left: Punchy 2-Line Headline */}
            <div>
              <h2 className="text-[clamp(2.3rem,4.4vw,3.9rem)] font-bold tracking-tight text-theme-primary leading-[1.14]">
                <span className="block">Have a question?</span>
                <span className="block text-primary-gradient">We are here to answer.</span>
              </h2>
            </div>

            {/* Right: Contact Hint & Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:self-center shrink-0">
              <p className="text-xs sm:text-sm text-theme-secondary font-normal max-w-[210px] leading-snug">
                Still confused? no need to worry, just contact us
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 hover:from-emerald-400 hover:via-emerald-500 hover:to-green-500 hover:shadow-emerald-600/30 hover:scale-105 transition-all duration-200 group cursor-pointer shrink-0"
              >
                <span>Contact us</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

          </div>
        </Reveal>

        {/* 3. Two-Column Layout (Matching User Reference Image) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          
          {/* Left Column: Stacked Interactive Category Cards */}
          <div className="lg:col-span-4 space-y-4">
            <Reveal direction="right" delay={140} duration={700}>
              <div className="space-y-4">
                {FAQ_SIDEBAR_CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  const Icon = cat.icon;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        const first = FAQ_DATA.find((f) => f.category === cat.id);
                        if (first) setOpenFaqId(first.id);
                      }}
                      className={cn(
                        "rounded-3xl p-6 text-left transition-all duration-300 cursor-pointer select-none group border border-transparent",
                        isActive
                          ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-md scale-[1.02]"
                          : "bg-transparent hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 hover:border-emerald-500/20 text-theme-primary"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Icon
                          className={cn(
                            "w-5 h-5 transition-transform group-hover:scale-110",
                            isActive ? "text-white" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        />
                        <h4
                          className={cn(
                            "text-lg font-bold tracking-tight transition-colors",
                            isActive
                              ? "text-white"
                              : "text-theme-primary group-hover:text-emerald-700 dark:group-hover:text-emerald-300"
                          )}
                        >
                          {cat.title}
                        </h4>
                      </div>
                      <p
                        className={cn(
                          "text-xs sm:text-[13px] leading-relaxed font-normal transition-colors",
                          isActive
                            ? "text-emerald-50/90"
                            : "text-theme-secondary group-hover:text-theme-primary"
                        )}
                      >
                        {cat.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>

          {/* Right Column: Dynamic Category Title + Clean Borderless Accordion */}
          <div className="lg:col-span-8">
            <Reveal direction="left" delay={180} duration={700}>
              {/* Dynamic Category Heading */}
              <div className="mb-6 sm:mb-8 text-left">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary leading-tight">
                  {currentCategory.title} Questions
                </h3>
              </div>

              {/* Frameless Clean Question List */}
              <div className="divide-y divide-theme-border/40 text-left">
                {filteredFaqs.map((faq) => {
                  const isOpen = openFaqId === faq.id;

                  return (
                    <div
                      key={faq.id}
                      className="py-5 sm:py-6 transition-colors duration-200"
                    >
                      {/* Question Row */}
                      <button
                        type="button"
                        onClick={() => toggleFaq(faq.id)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 text-left cursor-pointer group"
                      >
                        <h4 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors pr-2 leading-snug">
                          {faq.question}
                        </h4>

                        {/* Clean Chevron Icon */}
                        <span className="shrink-0 text-theme-secondary group-hover:text-theme-primary transition-colors">
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 stroke-[2.2]" />
                          ) : (
                            <ChevronDown className="w-5 h-5 stroke-[2.2]" />
                          )}
                        </span>
                      </button>

                      {/* Collapsible Answer */}
                      {isOpen && (
                        <div className="pt-3 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          <p className="text-xs sm:text-sm lg:text-[14.5px] text-theme-secondary leading-relaxed font-normal max-w-3xl">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Reveal>

          </div>

        </div>

        {/* 4. Bottom Knowledge Centre Link */}
        <Reveal direction="fade" delay={220} duration={600}>
          <div className="text-center flex justify-center pt-8 sm:pt-10">
            <Link
              href="/knowledge-centre"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-theme-primary hover:text-theme-highlight underline underline-offset-4 decoration-theme-primary/30 hover:decoration-theme-highlight transition-all duration-200 group cursor-pointer"
            >
              <span>Explore the Knowledge Centre</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </Reveal>

      </div>
    </section>
  );
}
