"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabOption {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SegmentedTabsProps {
  options: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function SegmentedTabs({
  options,
  activeId,
  onChange,
  className,
}: SegmentedTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex p-1.5 rounded-2xl bg-theme-surface border border-theme-border flex-wrap gap-1 items-center",
        className
      )}
      role="tablist"
    >
      {options.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              isActive
                ? "text-white bg-primary-gradient shadow-md"
                : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover"
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-theme-border text-theme-muted"
                )}
              >
                {tab.count}
              </span>
            )}
            {/* Active subtle gradient underline indicator */}
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-white/40 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
