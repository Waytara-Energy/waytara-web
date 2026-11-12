"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LogoMark } from "@/components/shared/logo";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useDeviceHub } from "./device-live-hub";

/** How long the pointer rests on the icon before the sidebar opens. */
const HOVER_OPEN_MS = 1000;

/** The brand mark in a circle that opens the sidebar: at rest it is the logo, pointing at it opens the sidebar (and it turns into the open icon). On a
 *  phone it stays the logo and opens the sidebar sheet. `floating` pins it to the top left of the window (desktop) and shows it only
 *  while the sidebar is closed - open, the sidebar has the full logo and its own collapse icon. */
export function SidebarBrandToggle({ floating = false, className }: { floating?: boolean; className?: string }) {
  const { toggleSidebar, setOpen, state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const timer = React.useRef<number | null>(null);
  const cancelHover = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  React.useEffect(() => () => cancelHover(), []);
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  // The badge: the logo stays as it is. While devices are not reporting, a small red badge sits on its corner: a plain dot for one device, the number for
  // more (9+ for more than nine). It goes away by itself when they report again.
  const { problems } = useDeviceHub();
  const down = problems.length;
  const label = (isMobile ? "Open menu" : collapsed ? "Show sidebar" : "Hide sidebar") + (down ? `. ${down === 1 ? "1 device is" : `${down} devices are`} not reporting` : "");
  return (
    <button
      type="button"
      // Resting on the icon for a second opens the sidebar; a click opens it at once.
      onClick={() => {
        cancelHover();
        toggleSidebar();
      }}
      onMouseEnter={() => {
        if (!collapsed || isMobile) return;
        cancelHover();
        timer.current = window.setTimeout(() => {
          setOpen(true);
        }, HOVER_OPEN_MS);
      }}
      onMouseLeave={cancelHover}
      aria-label={label}
      className={cn(
        "group/brand relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-sidebar-accent/70 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        floating && "fixed left-3 top-[calc(clamp(3.5rem,4.5vw,4.25rem)/2-1.125rem)] z-30 transition-all duration-300 max-md:hidden",
        floating && !collapsed && "pointer-events-none -translate-x-2 opacity-0",
        className
      )}
    >
      <LogoMark className="size-[22px] transition-all duration-200 group-hover/brand:scale-75 group-hover/brand:opacity-0 group-focus-visible/brand:scale-75 group-focus-visible/brand:opacity-0 max-md:group-hover/brand:scale-100 max-md:group-hover/brand:opacity-100" />
      {down > 0 &&
        (down === 1 ? (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-rose-500 ring-2 ring-background" />
        ) : (
          <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
            {down > 9 ? "9+" : down}
          </span>
        ))}
      <Icon className="absolute size-[18px] scale-75 text-sidebar-foreground opacity-0 transition-all duration-200 group-hover/brand:scale-100 group-hover/brand:opacity-100 group-focus-visible/brand:scale-100 group-focus-visible/brand:opacity-100 max-md:hidden" />
    </button>
  );
}
