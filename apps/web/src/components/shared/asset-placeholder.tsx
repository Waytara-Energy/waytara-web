import * as React from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetPlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  aspectRatio?: "square" | "video" | "wide" | "tall" | "auto";
  icon?: boolean;
}

export function AssetPlaceholder({
  label,
  aspectRatio = "video",
  icon = true,
  className,
  ...props
}: AssetPlaceholderProps) {
  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[21/9]",
    tall: "aspect-[3/4]",
    auto: "h-full w-full min-h-[140px]",
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl border border-dashed border-theme-border bg-theme-surface/60 p-4 text-center select-none overflow-hidden transition-colors hover:border-emerald-500/40",
        aspectClasses[aspectRatio],
        className
      )}
      {...props}
    >
      {icon && (
        <ImageIcon className="h-6 w-6 text-theme-muted mb-2 opacity-60" />
      )}
      <span className="font-mono text-xs text-theme-secondary font-medium tracking-tight bg-theme-surface px-2.5 py-1 rounded-md border border-theme-border/50">
        [asset: {label}]
      </span>
    </div>
  );
}
