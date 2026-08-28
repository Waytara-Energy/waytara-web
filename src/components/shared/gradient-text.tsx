import * as React from "react";
import { cn } from "@/lib/utils";

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function GradientText({ children, className, ...props }: GradientTextProps) {
  return (
    <span
      className={cn(
        "bg-primary-gradient bg-clip-text text-transparent font-semibold",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
