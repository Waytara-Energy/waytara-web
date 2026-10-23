"use client";

import { Waypoints } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FlowLegend } from "./flow-legend";

/** The header's button for the energy-flow colour key: a click opens the key in a small popover. */
export function FlowLegendButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Energy flow colours"
          title="Energy flow colours"
          className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border border-border px-2 text-muted-foreground outline-none transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Waypoints className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto rounded-2xl p-4">
        <FlowLegend />
      </PopoverContent>
    </Popover>
  );
}
