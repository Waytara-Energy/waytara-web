import * as React from "react";
import { cn } from "@/lib/utils";

interface HighlightNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string | number;
  unit?: string;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function HighlightNumber({
  value,
  unit,
  label,
  size = "md",
  className,
  ...props
}: HighlightNumberProps) {
  const sizeStyles = {
    sm: "text-lg md:text-xl font-bold",
    md: "text-2xl md:text-3xl font-extrabold tracking-tight",
    lg: "text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight",
    xl: "text-4xl md:text-5xl lg:text-6xl font-black tracking-tight",
  };

  return (
    <div className={cn("inline-flex flex-col", className)} {...props}>
      <div className="inline-flex items-baseline gap-1">
        <span className={cn(sizeStyles[size], "text-theme-highlight")}>
          {value}
        </span>
        {unit && (
          <span className="text-sm font-semibold text-theme-muted uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>
      {label && (
        <span className="text-xs text-theme-secondary font-medium mt-0.5">
          {label}
        </span>
      )}
    </div>
  );
}
