"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  User,
  Home,
  Building,
  Factory,
  Building2,
  Truck,
  Cpu,
  ArrowDown,
  RotateCcw,
  Pencil,
  CheckCircle2,
  Zap,
  ShieldCheck,
  CalendarCheck,
  TrendingDown,
  SunMedium,
  BatteryCharging,
  Car,
  Send,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { calculateRecommendation } from "@/lib/recommend";
import { EnergyPlannerInput, CustomerSegmentId, RecommendationResult } from "@/types";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/shared/reveal";

interface QuestionStep {
  id: number;
  question: string;
  inputType: "options" | "bill_options";
  options: Array<{
    label: string;
    sub?: string;
    value: any;
    icon?: React.ElementType;
  }>;
}

const STEPS: QuestionStep[] = [
  {
    id: 0,
    question: "What type of property are we designing for?",
    inputType: "options",
    options: [
      {
        label: "Residential Villa / Home",
        sub: "Independent Houses, Bungalows",
        value: "independent_house",
        icon: Home,
      },
      {
        label: "Apartment Community",
        sub: "Gated Societies, High-Rises",
        value: "apartment",
        icon: Building,
      },
      {
        label: "Factory / Manufacturing",
        sub: "Heavy Industry, Processing Plants",
        value: "commercial_building",
        icon: Factory,
      },
      {
        label: "Commercial Office / Retail",
        sub: "Corporate Hubs, Hospitals, Malls",
        value: "commercial_building",
        icon: Building2,
      },
      {
        label: "EV Fleet Charging Depot",
        sub: "Logistics, Delivery & Bus Depots",
        value: "fleet_depot",
        icon: Truck,
      },
      {
        label: "IT Park & Tech Campus",
        sub: "Data-heavy Infrastructure",
        value: "commercial_building",
        icon: Cpu,
      },
    ],
  },
  {
    id: 1,
    question: "What is your average monthly electricity spend?",
    inputType: "bill_options",
    options: [
      { label: "₹3,000 – ₹8,000 / mo", sub: "Avg. 250–600 units", value: 6000 },
      { label: "₹8,000 – ₹20,000 / mo", sub: "Avg. 600–1,500 units", value: 14000 },
      { label: "₹20,000 – ₹60,000 / mo", sub: "Avg. 1,500–5,000 units", value: 35000 },
      { label: "₹60,000 – ₹2 Lakhs / mo", sub: "Commercial / High-demand", value: 110000 },
      { label: "₹2 Lakhs – ₹10 Lakhs+ / mo", sub: "Industrial Scale", value: 350000 },
    ],
  },
  {
    id: 2,
    question: "What is your power backup priority during outages?",
    inputType: "options",
    options: [
      {
        label: "Full 24/7 Autonomy",
        sub: "Zero outage downtime. Run heavy ACs, motors & whole premises",
        value: "full_home",
        icon: Zap,
      },
      {
        label: "Essential Load Backup",
        sub: "Keep lights, Wi-Fi, computers & refrigeration running",
        value: "critical_only",
        icon: BatteryCharging,
      },
      {
        label: "Maximum Bill Savings First",
        sub: "Grid is mostly stable. Focus on solar generation & net metering ROI",
        value: "none",
        icon: TrendingDown,
      },
    ],
  },
  {
    id: 3,
    question: "Do you have Electric Vehicles (EVs) at this property?",
    inputType: "options",
    options: [
      {
        label: "1–2 Personal EVs",
        sub: "Residential Level-2 Smart Charging",
        value: "have_one_ev",
        icon: Car,
      },
      {
        label: "Commercial Fleet Hub",
        sub: "Multi-gun high-power DC fast charging",
        value: "commercial_fleet",
        icon: Truck,
      },
      {
        label: "Planning to Buy in 1–2 Years",
        sub: "Future-proof the electrical infrastructure today",
        value: "planning_soon",
        icon: Sparkles,
      },
      {
        label: "No EVs at Present",
        sub: "Focus strictly on solar & battery storage",
        value: "no_ev",
        icon: Home,
      },
    ],
  },
  {
    id: 4,
    question: "What type of roof or installation space is available?",
    inputType: "options",
    options: [
      {
        label: "Flat Concrete Rooftop (RCC)",
        sub: "Standard non-penetrating ballasted mounting",
        value: "rcc_flat",
      },
      {
        label: "Industrial Metal / Tin Shed",
        sub: "Direct trapezoidal seam clamping",
        value: "metal_sheet",
      },
      {
        label: "Elevated Terrace Canopy",
        sub: "High-clearance structure preserving usable terrace space",
        value: "elevated_structure",
      },
      {
        label: "Tiled / Sloped Roof",
        sub: "Specialized pitched roof brackets",
        value: "tiled_slope",
      },
    ],
  },
];

function AnimatedLightningAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/25 mt-0.5",
        className
      )}
    >
      {/* Ambient electric energy ripple */}
      <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping opacity-60 pointer-events-none" />
      {/* High-contrast animated lightning bolt */}
      <Zap className="w-4 h-4 fill-white text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse relative z-10" />
    </div>
  );
}

interface EnergyPlannerProps {
  selectedSegment?: CustomerSegmentId;
}

export function EnergyPlanner({ selectedSegment }: EnergyPlannerProps) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const [inView, setInView] = React.useState(false);
  const [typedText, setTypedText] = React.useState("");
  const [isTypingFirstQ, setIsTypingFirstQ] = React.useState(true);

  const [currentStepIndex, setCurrentStepIndex] = React.useState<number>(0);
  const [lastUserAnswer, setLastUserAnswer] = React.useState<string | null>(null);
  const [answersHistory, setAnswersHistory] = React.useState<string[]>([]);
  const [isTyping, setIsTyping] = React.useState<boolean>(false);
  const [customBill, setCustomBill] = React.useState<string>("");
  const [recommendation, setRecommendation] = React.useState<RecommendationResult | null>(null);

  const firstQuestionFullText = STEPS[0].question;

  // Observe when section enters viewport
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Typewriter effect on initial landing
  React.useEffect(() => {
    if (!inView || currentStepIndex !== 0) {
      if (currentStepIndex !== 0) {
        setIsTypingFirstQ(false);
      }
      return;
    }

    let charIndex = 0;
    setTypedText("");
    setIsTypingFirstQ(true);

    const interval = setInterval(() => {
      if (charIndex <= firstQuestionFullText.length) {
        setTypedText(firstQuestionFullText.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(interval);
        setIsTypingFirstQ(false);
      }
    }, 28);

    return () => clearInterval(interval);
  }, [inView, currentStepIndex, firstQuestionFullText]);

  // Assessment Booking Modal state
  const [assessmentModalOpen, setAssessmentModalOpen] = React.useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = React.useState(false);
  const [leadSubmitted, setLeadSubmitted] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [contactPincode, setContactPincode] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot

  // Accumulated Planner Form State
  const [plannerData, setPlannerData] = React.useState<EnergyPlannerInput>({
    propertyType: "independent_house",
    state: "Maharashtra",
    monthlyBill: 7500,
    backupNeeds: "full_home",
    evPlans: "planning_soon",
    roofType: "rcc_flat",
    budgetTier: "balanced_independence",
  });

  const resetPlanner = () => {
    setCurrentStepIndex(0);
    setLastUserAnswer(null);
    setAnswersHistory([]);
    setIsTyping(false);
    setRecommendation(null);
    setLeadSubmitted(false);
  };

  const handleGoBack = () => {
    if (recommendation) {
      setRecommendation(null);
      const prevIdx = STEPS.length - 1;
      setCurrentStepIndex(prevIdx);
      setLastUserAnswer(answersHistory[prevIdx - 1] || null);
    } else if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      setLastUserAnswer(prevIdx > 0 ? answersHistory[prevIdx - 1] : null);
    }
  };

  const handleSelectOption = (value: any, displayLabel: string) => {
    // 1. Immediately set the user's latest answer & save history
    setLastUserAnswer(displayLabel);
    setAnswersHistory((prev) => {
      const nextArr = [...prev];
      nextArr[currentStepIndex] = displayLabel;
      return nextArr.slice(0, currentStepIndex + 1);
    });

    // 2. Save choice
    let updatedConfig = { ...plannerData };
    if (currentStepIndex === 0) updatedConfig.propertyType = value;
    if (currentStepIndex === 1) updatedConfig.monthlyBill = Number(value);
    if (currentStepIndex === 2) updatedConfig.backupNeeds = value;
    if (currentStepIndex === 3) updatedConfig.evPlans = value;
    if (currentStepIndex === 4) updatedConfig.roofType = value;
    setPlannerData(updatedConfig);

    // 3. Briefly show typing indicator and advance to next question
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);

      if (currentStepIndex < STEPS.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      } else {
        // Final step: synthesize recommendations
        const result = calculateRecommendation(updatedConfig);
        setRecommendation(result);
        try {
          confetti({
            particleCount: 65,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (_) {}
      }
    }, 450);
  };

  const handleCustomBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(customBill);
    if (!val || val < 500) return;
    handleSelectOption(val, `₹${val.toLocaleString("en-IN")} / month`);
    setCustomBill("");
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone) return;

    setIsSubmittingLead(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: contactName,
          email: contactEmail,
          phone: contactPhone,
          pincode: contactPincode,
          propertyType: plannerData.propertyType,
          monthlyBill: plannerData.monthlyBill,
          backupNeeds: plannerData.backupNeeds,
          evPlans: plannerData.evPlans,
          roofType: plannerData.roofType,
          recommendedPackage: recommendation?.packageName,
          estimatedSolarKw: recommendation?.solarSizeKw,
          estimatedBatteryKwh: recommendation?.batterySizeKwh,
          source: "energy_planner",
          website,
        }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Something went wrong. Please try again.");
      }

      setLeadSubmitted(true);
      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (_) {}
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const currentQ = STEPS[currentStepIndex];

  return (
    <section
      id="energy-planner"
      ref={sectionRef}
      className="section-padding bg-theme-bg relative scroll-mt-16 overflow-hidden"
    >
      <div className="fluid-container max-w-4xl">
        
        {/* 1. Top Pill Badge matching Who We Are / Who We Serve */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                Interactive Energy Planner
              </span>
            </div>
          </div>
        </Reveal>

        {/* 2. Split Section Header */}
        <Reveal direction="up" delay={120} duration={700}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <h2 className="text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18]">
              <span className="block">Plan Your System.</span>
              <span className="block text-primary-gradient">Guided by Tara AI.</span>
            </h2>
            <div className="flex items-center justify-between md:justify-end gap-4 max-w-md lg:max-w-lg w-full">
              <p className="text-sm sm:text-base text-theme-secondary leading-relaxed md:pb-1">
                Answer a few quick questions to let our intelligent physics engine calculate your exact solar capacity, battery storage, and 25-year financial goals.
              </p>
              {(currentStepIndex > 0 || recommendation) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetPlanner}
                  className="text-xs text-theme-muted hover:text-theme-primary h-8 px-2.5 shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  <span>Restart</span>
                </Button>
              )}
            </div>
          </div>
        </Reveal>

        {/* 3. Sliding 2-Message Window: [User: Ans N-1] + [AI: Question N] */}
        <div className="space-y-6 pt-2">
          
          {/* Top Row: User's Previous Answer (Apple iMessage Pop-In Animation) */}
          {lastUserAnswer && (
            <div
              key={lastUserAnswer}
              className="flex flex-col items-end gap-1.5 animate-in fade-in zoom-in-75 slide-in-from-bottom-3 duration-350 origin-bottom-right"
            >
              <div className="flex gap-3.5 justify-end items-center">
                <div className="py-3 px-5 rounded-3xl rounded-tr-sm bg-emerald-600 text-white font-semibold text-sm sm:text-base shadow-md transform transition-transform hover:scale-[1.02]">
                  {lastUserAnswer}
                </div>
                <div className="w-9 h-9 rounded-full bg-theme-surface border border-theme-border text-theme-primary flex items-center justify-center shrink-0 shadow-sm mt-0.5 animate-in zoom-in-50 duration-300">
                  <User className="w-4 h-4" />
                </div>
              </div>

              {/* Edit / Change Previous Answer Icon Button */}
              <button
                type="button"
                onClick={handleGoBack}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-theme-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mr-12 pr-1 cursor-pointer group select-none animate-in fade-in duration-300"
                title="Go back to previous question and change answer"
              >
                <Pencil className="w-3 h-3 text-emerald-500 transition-transform group-hover:-rotate-12" />
                <span>Change previous answer</span>
              </button>
            </div>
          )}

          {/* Bottom Row: AI Question or Typing or Final Recommendation */}
          {isTyping ? (
            <div className="flex gap-3.5 items-center animate-in fade-in zoom-in-75 slide-in-from-bottom-2 duration-250 origin-bottom-left">
              <AnimatedLightningAvatar />
              <div className="py-3 px-4 rounded-3xl rounded-tl-sm bg-theme-surface border border-theme-border/60 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          ) : !recommendation ? (
            /* Current AI Question + Active Options (Apple iMessage Pop-In) */
            <div
              key={`ai-turn-${currentStepIndex}`}
              className="flex gap-3.5 items-start animate-in fade-in zoom-in-90 slide-in-from-bottom-2 duration-350 origin-top-left"
            >
              <AnimatedLightningAvatar />
              <div className="max-w-2xl w-full space-y-4">
                <div className="text-sm sm:text-base p-4 sm:p-5 rounded-3xl rounded-tl-sm bg-theme-surface/70 border border-theme-border/70 text-theme-primary shadow-sm font-medium leading-relaxed min-h-[58px] flex items-center animate-in fade-in zoom-in-95 duration-300 origin-top-left">
                  {currentStepIndex === 0 ? (
                    <span>
                      {typedText || (inView ? "" : currentQ.question)}
                      {isTypingFirstQ && (
                        <span className="inline-block w-[2px] h-4 bg-emerald-500 ml-1 animate-pulse align-middle" />
                      )}
                    </span>
                  ) : (
                    currentQ.question
                  )}
                </div>

                {/* Options */}
                <div
                  className={cn(
                    "space-y-3 pt-1 transition-all duration-500",
                    currentStepIndex === 0 && isTypingFirstQ
                      ? "opacity-0 pointer-events-none translate-y-3"
                      : "opacity-100 translate-y-0"
                  )}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentQ.options.map((opt, optIdx) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => handleSelectOption(opt.value, opt.label)}
                          style={{
                            animationDelay: `${optIdx * 75}ms`,
                            animationFillMode: "both",
                          }}
                          className={cn(
                            "text-left p-4 rounded-2xl border border-theme-border/80 bg-theme-surface hover:border-emerald-500/60 hover:bg-theme-surface-hover hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 group active:scale-[0.99]",
                            currentStepIndex === 0 && !isTypingFirstQ
                              ? "animate-in fade-in slide-in-from-bottom-3 duration-400"
                              : ""
                          )}
                        >
                          {Icon && (
                            <div className="w-8 h-8 rounded-xl bg-theme-bg border border-theme-border flex items-center justify-center text-theme-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30 shrink-0 transition-colors">
                              <Icon className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="font-semibold text-xs sm:text-sm text-theme-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {opt.label}
                            </div>
                            {opt.sub && (
                              <div className="text-[11px] text-theme-secondary mt-0.5 leading-snug">
                                {opt.sub}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Bill Input on Step 1 */}
                  {currentQ.inputType === "bill_options" && (
                    <form
                      onSubmit={handleCustomBillSubmit}
                      className="flex items-center gap-2 pt-2"
                    >
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-theme-muted">
                          ₹
                        </span>
                        <Input
                          type="number"
                          placeholder="Or enter your exact monthly electricity bill..."
                          value={customBill}
                          onChange={(e) => setCustomBill(e.target.value)}
                          className="h-10 pl-8 text-xs bg-theme-surface rounded-xl"
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!customBill || Number(customBill) < 500}
                        className="h-10 text-xs px-4 rounded-xl font-semibold cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        <span>Apply</span>
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Final Recommendation as a Proper Unified AI Chat Response Bubble */
            <div className="flex gap-3.5 items-start animate-in fade-in zoom-in-95 duration-500">
              <AnimatedLightningAvatar />
              
              {/* Single Unified AI Chat Message Bubble */}
              <div className="max-w-3xl w-full p-6 sm:p-7 rounded-3xl rounded-tl-sm bg-theme-surface/85 border border-theme-border text-theme-primary shadow-lg space-y-6">
                
                {/* 1. Conversational Intro */}
                <div className="text-sm sm:text-base leading-relaxed text-theme-secondary">
                  Based on your property inputs, here is your customized <strong className="text-theme-primary font-bold">{recommendation.packageName}</strong> clean energy blueprint and 25-year goal breakdown:
                </div>

                {/* 2. Structured Metric Grid inside the Chat Bubble */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-theme-bg/80 border border-theme-border/70">
                    <div className="flex items-center gap-1.5 text-xs text-theme-muted mb-1 font-medium">
                      <SunMedium className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Solar Array</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-theme-primary">
                      {recommendation.solarSizeKw} <span className="text-xs font-semibold text-theme-muted">kWp</span>
                    </div>
                    <div className="text-[10px] text-theme-muted mt-0.5">N-Type TOPCon</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-theme-bg/80 border border-theme-border/70">
                    <div className="flex items-center gap-1.5 text-xs text-theme-muted mb-1 font-medium">
                      <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Smart Battery</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-theme-primary">
                      {recommendation.batterySizeKwh > 0 ? (
                        <>
                          {recommendation.batterySizeKwh} <span className="text-xs font-semibold text-theme-muted">kWh</span>
                        </>
                      ) : (
                        "Grid-Tied"
                      )}
                    </div>
                    <div className="text-[10px] text-theme-muted mt-0.5">
                      {recommendation.batterySizeKwh > 0 ? "Modular LFP" : "Expandable"}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-theme-bg/80 border border-theme-border/70">
                    <div className="flex items-center gap-1.5 text-xs text-theme-muted mb-1 font-medium">
                      <Zap className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Monthly Save</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Math.round(recommendation.yearlySavingsInr / 12).toLocaleString("en-IN")}
                    </div>
                    <div className="text-[10px] text-theme-muted mt-0.5">Up to 90% Bill Offset</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-theme-bg/80 border border-theme-border/70">
                    <div className="flex items-center gap-1.5 text-xs text-theme-muted mb-1 font-medium">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                      <span>ROI Payback</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-theme-primary">
                      {recommendation.paybackPeriodYears} <span className="text-xs font-semibold text-theme-muted">Yrs</span>
                    </div>
                    <div className="text-[10px] text-theme-muted mt-0.5">25-Yr System Life</div>
                  </div>
                </div>

                {/* 3. Engineering Scope & Rationale (Formatted like clean AI markdown points) */}
                <div className="space-y-2.5 pt-1 border-t border-theme-border/60">
                  <h4 className="text-xs font-bold text-theme-primary uppercase tracking-wider pt-2">
                    Engineering Scope &amp; Rationale
                  </h4>
                  <div className="space-y-2">
                    {recommendation.rationale.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 text-xs sm:text-[13px] text-theme-secondary leading-relaxed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Financial Impact Strip & Action Buttons inside the message */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2.5 text-left">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <strong className="text-theme-primary font-bold text-sm block">
                        25-Year Cumulative Savings: ₹{(Math.round(recommendation.yearlySavingsInr * 25) / 100000).toFixed(1)} Lakhs
                      </strong>
                      <span className="text-theme-muted text-[11px]">
                        Generates ~{recommendation.yearlyGenerationKwh.toLocaleString("en-IN")} kWh clean electricity &amp; offsets {recommendation.co2OffsetTonnesPerYear} tons CO₂/yr.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetPlanner}
                      className="text-xs text-theme-muted hover:text-theme-primary h-9 px-3 rounded-xl cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      <span>Start Over</span>
                    </Button>
                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={() => setAssessmentModalOpen(true)}
                      className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer shadow-md"
                    >
                      <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                      <span>Claim Quote</span>
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

      {/* 4. Assessment Booking Dialog */}
      <Dialog open={assessmentModalOpen} onOpenChange={setAssessmentModalOpen}>
        <DialogContent className="max-w-md p-6 sm:p-8 rounded-3xl">
          <DialogHeader className="text-left pb-3 border-b border-theme-border">
            <DialogTitle className="text-xl font-bold text-theme-primary">
              Book Engineering Site Assessment
            </DialogTitle>
            <DialogDescription className="text-xs text-theme-secondary pt-1">
              Lock in your AI blueprint for <strong>{recommendation?.packageName}</strong> ({recommendation?.solarSizeKw} kW Solar • {recommendation?.batterySizeKwh} kWh Storage).
            </DialogDescription>
          </DialogHeader>

          {!leadSubmitted ? (
            <form onSubmit={handleLeadSubmit} className="space-y-4 pt-2">
              {/* Honeypot — off-screen, never focusable/visible to real visitors */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="epWebsite">Website</label>
                <input
                  id="epWebsite"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {submitError && (
                <div className="rounded-xl border border-theme-border bg-red-500/10 px-3 py-2.5 text-xs text-red-500">
                  {submitError}
                </div>
              )}

              <div>
                <Label htmlFor="cName" className="text-xs font-semibold text-theme-secondary">
                  Full Name *
                </Label>
                <Input
                  id="cName"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-10 text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="cPhone" className="text-xs font-semibold text-theme-secondary">
                  Mobile Number (for engineering dispatch) *
                </Label>
                <Input
                  id="cPhone"
                  required
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="h-10 text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cEmail" className="text-xs font-semibold text-theme-secondary">
                    Email Address
                  </Label>
                  <Input
                    id="cEmail"
                    type="email"
                    placeholder="name@company.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="h-10 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cPincode" className="text-xs font-semibold text-theme-secondary">
                    Pin Code
                  </Label>
                  <Input
                    id="cPincode"
                    placeholder="e.g. 400001"
                    value={contactPincode}
                    onChange={(e) => setContactPincode(e.target.value)}
                    className="h-10 text-xs mt-1"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="gradient"
                className="w-full h-11 text-xs font-semibold mt-2 cursor-pointer"
                disabled={isSubmittingLead}
              >
                {isSubmittingLead ? "Scheduling Site Engineer..." : "Confirm Free Assessment & Quote"}
              </Button>
            </form>
          ) : (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-theme-primary">
                Assessment Request Confirmed!
              </h4>
              <p className="text-xs text-theme-secondary leading-relaxed">
                A WayTara Power Systems Engineer will contact <strong>{contactPhone}</strong> within 2 business hours to review your site layout and provide the formal proposal.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssessmentModalOpen(false)}
                className="mt-2 text-xs cursor-pointer"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </section>
  );
}
