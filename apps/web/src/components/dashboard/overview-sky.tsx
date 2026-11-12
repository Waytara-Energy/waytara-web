"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { CloudShader } from "@/components/ui/cloud-shader";
import { useHasMounted } from "@/hooks/use-has-mounted";

const HOST = '[data-slot="sidebar-inset"]';
const subscribe = () => () => undefined;

// The same sky as the landing page's first screen (a day sky and, in the dark theme, the same sky at dusk). By day the top is a little lighter than the
// landing page's, because here the dashboard header's dark icons and names sit right on it (on the landing page they are white on a shade).
const SKY_DAY = { top: "#5f9fd6", bottom: "#a9d2f0", cloud: "#fbf8f2" };
const SKY_DUSK = { top: "#070d1f", bottom: "#1b2a4a", cloud: "#8d9bb8" };

// How tall the sky is, and how far the page has to scroll to take it away.
const SKY_HEIGHT = "clamp(240px, 36vh, 360px)";
const SKY_SCROLL_PX = 160;
const PROGRESS_VAR = "--overview-sky-gone";

/**
 * The cloud sky across the top of the Overview, the way the landing page has it: clouds drifting at the very top that melt into the page colour a
 * third of the way down. Like the person's own background picture (OverviewBackdrop) it is painted into the dashboard's content area behind everything,
 * the header included, which is clear while the sky shows. It does not scroll with the cards: as the page is scrolled it fades away (over the first
 * 160 px) and the header turns back into its usual page-coloured bar as it goes, so the cards never slide under a clear header.
 *
 * Shown only when the person has not chosen a background of their own for the Overview (Application Settings).
 */
export function OverviewSky() {
  const host = React.useSyncExternalStore(subscribe, () => document.querySelector<HTMLElement>(HOST), () => null);
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const sky = mounted && resolvedTheme === "dark" ? SKY_DUSK : SKY_DAY;

  // How far the sky is gone (0 = fully there, 1 = gone) follows the scroll of the page's own scroll region, and is shared as a CSS variable so the sky
  // and the header both read it without React re-rendering on every scroll event.
  React.useEffect(() => {
    if (!host) return;
    const scroller = host.querySelector<HTMLElement>("main");
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const gone = Math.min(1, Math.max(0, scroller.scrollTop / SKY_SCROLL_PX));
      host.style.setProperty(PROGRESS_VAR, gone.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      host.style.removeProperty(PROGRESS_VAR);
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <>
      {/* While the sky shows the header is clear; as it goes the header's own page colour (and the soft edge under it) comes back in step. */}
      <style>{`${HOST} > header{background:color-mix(in srgb,var(--background) calc(var(${PROGRESS_VAR},0) * 100%),transparent)!important}${HOST} > header::after{opacity:var(${PROGRESS_VAR},0)}`}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden"
        style={{
          height: SKY_HEIGHT,
          opacity: `calc(1 - var(${PROGRESS_VAR}, 0))`,
          // clear of any cloud by a third of the way down, and the page colour from there to the bottom edge
          maskImage: "linear-gradient(to bottom, #000 0, #000 30%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0, #000 30%, transparent 100%)",
          background: `linear-gradient(to bottom, ${sky.top}, ${sky.bottom})`,
        }}
      >
        <CloudShader
          className="absolute inset-0 h-full min-h-0"
          skyTopColor={sky.top}
          skyBottomColor={sky.bottom}
          cloudColor={sky.cloud}
          maxPixelRatio={1}
        />
      </div>
    </>,
    host,
  );
}
