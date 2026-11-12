"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const HOST = '[data-slot="sidebar-inset"]';
/** How far the page has to scroll for the drawing to be back at its usual size. */
const SCROLL_PX = 140;
const GROW = "--flow-grow";

/**
 * On a phone the energy flow starts larger - as wide as the screen, past the page's side padding - and shrinks to its usual width over the first
 * stretch of scrolling; after that the page scrolls on as normal. `--flow-grow` (1 = at the top, 0 = usual size) follows the page's scroll region and is
 * read by the CSS below, so nothing re-renders while scrolling. From the `sm` breakpoint up it does nothing.
 */
export function FlowGrow({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest<HTMLElement>(HOST)?.querySelector<HTMLElement>("main");
    if (!el || !scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const t = Math.min(1, Math.max(0, scroller.scrollTop / SCROLL_PX));
      // eased, so it settles gently into its usual size
      el.style.setProperty(GROW, (1 - t * (2 - t)).toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      ref={ref}
      // (24 px of page padding each side is given up at the top: 3rem in all)
      className={cn("max-sm:mx-[calc(var(--flow-grow,1)*-1.5rem)] max-sm:w-[calc(100%+var(--flow-grow,1)*3rem)]", className)}
    >
      {children}
    </div>
  );
}
