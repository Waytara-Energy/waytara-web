import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  id: number | string;
  title: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepIndicatorProps) {
  return (
    <div className={cn("w-full py-2", className)}>
      {/* Desktop horizontal flow */}
      <div className="hidden sm:flex items-center justify-between relative w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                disabled={!onStepClick || isUpcoming}
                onClick={() => onStepClick && onStepClick(index)}
                className={cn(
                  "group flex flex-col items-center focus:outline-none transition-all",
                  onStepClick && !isUpcoming ? "cursor-pointer" : "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300",
                    isCompleted &&
                      "bg-primary-gradient text-white border-transparent shadow-sm",
                    isCurrent &&
                      "border-emerald-500 bg-theme-surface text-theme-highlight ring-4 ring-emerald-500/20 shadow-md",
                    isUpcoming &&
                      "border-theme-border bg-theme-surface text-theme-muted"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-semibold text-center max-w-[90px] truncate transition-colors",
                    isCurrent && "text-theme-highlight font-bold",
                    isCompleted && "text-theme-primary",
                    isUpcoming && "text-theme-muted"
                  )}
                >
                  {step.title}
                </span>
              </button>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-all duration-300 rounded-full",
                    index < currentStep ? "bg-primary-gradient" : "bg-theme-border"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile compact progress */}
      <div className="flex sm:hidden flex-col gap-2 w-full">
        <div className="flex items-center justify-between text-xs font-semibold text-theme-secondary">
          <span className="text-theme-highlight uppercase tracking-wider">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-theme-primary font-medium">
            {steps[currentStep]?.title}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-theme-surface border border-theme-border overflow-hidden">
          <div
            className="h-full bg-primary-gradient transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
