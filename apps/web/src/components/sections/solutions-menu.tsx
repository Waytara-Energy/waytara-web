"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANNER_LINK, SOLUTIONS_HUB, SOLUTION_NEEDS, SOLUTION_SEGMENTS } from "@/config/site-nav";

/**
 * The header's "Solutions" dropdown: the six property types on the left, the three things WayTara does on the right.
 * Opens on hover and on keyboard focus/click, closes on Escape, outside click, or choosing a link. The panel is always a solid
 * card (not tinted by the header), so it reads the same over the hero and over a normal page.
 */
export function SolutionsMenu({ triggerClassName }: { triggerClassName: string }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHover = React.useRef(false);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  // A short delay so the pointer can cross the small gap between the button and the panel without the panel vanishing.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  React.useEffect(() => cancelClose, []);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        if (!open) openedByHover.current = true;
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="solutions-menu-panel"
        onClick={() => {
          // With a mouse the pointer has already opened the panel by the time it clicks, so that click must not close it again.
          if (open && openedByHover.current) openedByHover.current = false;
          else setOpen((v) => !v);
        }}
        className={cn(triggerClassName, "inline-flex items-center gap-1")}
      >
        {SOLUTIONS_HUB.label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div id="solutions-menu-panel" className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
          <div className="w-[min(46rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-theme-border bg-theme-bg text-theme-primary shadow-xl">
            <div className="grid grid-cols-5">
              <div className="col-span-3 p-4">
                <div className="flex items-baseline justify-between px-3 pb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">By property</p>
                  <Link
                    href={SOLUTIONS_HUB.href}
                    onClick={() => setOpen(false)}
                    className="text-xs font-semibold text-theme-highlight hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    All solutions
                  </Link>
                </div>
                <ul>
                  {SOLUTION_SEGMENTS.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-3 py-2 transition-colors hover:bg-theme-surface focus-visible:bg-theme-surface focus-visible:outline-none"
                      >
                        <span className="block text-[13.5px] font-semibold">{item.label}</span>
                        <span className="block text-xs text-theme-secondary">{item.blurb}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-span-2 border-l border-theme-border bg-theme-surface/60 p-4">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">By need</p>
                <ul>
                  {SOLUTION_NEEDS.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-3 py-2 transition-colors hover:bg-theme-bg focus-visible:bg-theme-bg focus-visible:outline-none"
                      >
                        <span className="block text-[13.5px] font-semibold">{item.label}</span>
                        <span className="block text-xs text-theme-secondary">{item.blurb}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Link
              href={PLANNER_LINK.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-t border-theme-border px-7 py-3 text-[13px] font-semibold text-theme-highlight transition-colors hover:bg-theme-surface focus-visible:bg-theme-surface focus-visible:outline-none"
            >
              <span>Not sure which fits? Use the Energy Planner</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
