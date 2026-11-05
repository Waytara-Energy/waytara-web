import * as React from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** The small green pill that opens every section ("Our Approach", "Who We Serve" ...). */
export function SectionBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors", className)}>
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
        <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" aria-hidden />
      </span>
      <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">{children}</span>
    </div>
  );
}

interface SectionHeaderProps {
  /** The pill's text. */
  badge: string;
  /** First line of the headline, in the normal text colour. */
  title: string;
  /** Second line of the headline, in the green gradient. Optional. */
  accent?: string;
  /** One or two sentences, set at the right end on wide screens. */
  summary?: React.ReactNode;
  /** "split" puts the headline left and the summary right (the landing page look); "center" stacks them in the middle. */
  align?: "split" | "center";
  className?: string;
}

/**
 * The opening block of a section: pill, a two-line headline (second line green), and a short summary.
 * Same type sizes and spacing as the landing page's "Our Approach" section, so every page opens the same way.
 */
export function SectionHeader({ badge, title, accent, summary, align = "split", className }: SectionHeaderProps) {
  const heading = (
    <h2 className="text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18]">
      <span className="block">{title}</span>
      {accent && <span className="block text-primary-gradient">{accent}</span>}
    </h2>
  );
  const body = summary && (
    <p className={cn("text-sm sm:text-base text-theme-secondary leading-relaxed", align === "split" ? "max-w-md lg:max-w-lg md:pb-1" : "max-w-2xl mx-auto")}>
      {summary}
    </p>
  );

  if (align === "center") {
    return (
      <div className={cn("mb-12 text-center", className)}>
        <div className="mb-6 flex justify-center">
          <SectionBadge>{badge}</SectionBadge>
        </div>
        <div className="mb-5">{heading}</div>
        {body}
      </div>
    );
  }

  return (
    <div className={cn("mb-12", className)}>
      <div className="mb-6">
        <SectionBadge>{badge}</SectionBadge>
      </div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        {heading}
        {body}
      </div>
    </div>
  );
}
