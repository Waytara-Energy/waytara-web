"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { CloudShader } from "@/components/ui/cloud-shader";
import { useHasMounted } from "@/hooks/use-has-mounted";

const HOST = '[data-slot="sidebar-inset"]';

// The same sky as the landing page's first screen (a day sky and, in the dark theme, the same sky at dusk). By day the top is a little lighter than the
// landing page's, because here the dashboard header sits right on it.
const SKY_DAY = { top: "#5f9fd6", bottom: "#a9d2f0", cloud: "#fbf8f2" };
const SKY_DUSK = { top: "#070d1f", bottom: "#1b2a4a", cloud: "#8d9bb8" };
// The page colours of the two themes (what the browser's bar goes back to once the sky has scrolled away).
const PAGE = { light: "#FFFFFF", dark: "#0A0F0D" };

// How tall the sky is, and how far the page has to scroll to take it away.
const SKY_HEIGHT = "clamp(240px, 36vh, 360px)";
const SKY_SCROLL_PX = 160;
/** 0 = the sky is fully there, 1 = it has scrolled away. Set on the dashboard's content area as the page scrolls; everything below reads it. */
const GONE = "--overview-sky-gone";
const g = `var(${GONE},0)`;
const there = `(1 - ${g})`;

// Everything the sky changes outside itself, as plain CSS that is in the page from the first byte (so the first paint is already right: this matters on an
// iPhone, where Safari colours the status bar from what it finds at the top of the page as it loads). The theme is a class on <html> that is set before
// anything is painted, so the day / dusk colours are chosen here in CSS and not by a script.
const CSS = `
:root{--overview-sky-top:${SKY_DAY.top};--overview-sky-bottom:${SKY_DAY.bottom}}
.dark{--overview-sky-top:${SKY_DUSK.top};--overview-sky-bottom:${SKY_DUSK.bottom}}
html:not([data-overview-scrolled]){background-color:var(--overview-sky-top)}
${HOST} > header{background:color-mix(in srgb,var(--background) calc(${g} * 100%),transparent)!important}
${HOST} > header::after{opacity:${g}}
${HOST} > header > div{margin-inline:-5px;padding:3px 5px;border-radius:9999px;background:color-mix(in srgb,var(--background) calc(${there} * 64%),transparent);-webkit-backdrop-filter:blur(calc(${there} * 14px)) saturate(calc(1 + ${there} * 0.6));backdrop-filter:blur(calc(${there} * 14px)) saturate(calc(1 + ${there} * 0.6));box-shadow:0 0 0 1px color-mix(in srgb,var(--foreground) calc(${there} * 9%),transparent),0 8px 22px -10px rgb(15 23 42 / calc(${there} * 0.4))}
${HOST} > header > div:empty{display:none}
`;

/**
 * The cloud sky across the top of the Overview, the way the landing page has it: clouds drifting at the very top that melt into the page colour a
 * third of the way down. It is pinned to the top of the window behind everything (the dashboard's content area is its own layer, and the header is
 * clear while the sky shows), and as the page is scrolled it fades away over the first 160 px while the header turns back into its usual page-coloured
 * bar, so the cards never slide under a clear header.
 *
 * THE HEADER OVER THE SKY: its two groups (the logo and the site on the left; the weather, the device icons and the bell on the right) each sit in a
 * frosted capsule of the page colour, so every control reads the same on the blue day sky, the navy dusk sky and the clouds, in both themes. The
 * capsules fade out with the sky, leaving the header exactly as it is on every other page.
 *
 * THE BROWSER'S BAR (an iPhone's status bar): while the sky shows, the colour at the top of the page is the sky's top colour (this layer is pinned to the
 * top edge and has that colour, <html> has it, and the theme-color tags are set to it); once the sky has scrolled away they are the page colour again.
 * The layer does not reach the bottom of the window, so the bottom toolbar keeps the page colour.
 *
 * Shown only when the person has not chosen a background of their own for the Overview (Application Settings). It must be rendered where no ancestor
 * inside the content area is positioned (the page's own top level), so that "the top" is the top of the window.
 */
export function OverviewSky() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const dark = mounted && resolvedTheme === "dark";
  const sky = dark ? SKY_DUSK : SKY_DAY;

  // How far the sky is gone follows the scroll of the page's own scroll region, shared as a CSS variable (no React re-render per scroll event). The same
  // moment decides the browser's bar: the sky's top colour while the sky shows, the page colour once it has gone.
  React.useEffect(() => {
    const host = ref.current?.closest<HTMLElement>(HOST);
    const scroller = host?.querySelector<HTMLElement>("main");
    if (!host || !scroller) return;
    const root = document.documentElement;
    const tags = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const before = tags.map((t) => t.getAttribute("content"));
    let frame = 0;
    let scrolled: boolean | null = null;
    const update = () => {
      frame = 0;
      const gone = Math.min(1, Math.max(0, scroller.scrollTop / SKY_SCROLL_PX));
      host.style.setProperty(GONE, gone.toFixed(3));
      const now = gone > 0.6;
      if (now === scrolled) return;
      scrolled = now;
      root.toggleAttribute("data-overview-scrolled", now);
      const colour = now ? (dark ? PAGE.dark : PAGE.light) : dark ? SKY_DUSK.top : SKY_DAY.top;
      tags.forEach((t) => t.setAttribute("content", colour));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      host.style.removeProperty(GONE);
      root.removeAttribute("data-overview-scrolled");
      tags.forEach((t, i) => {
        const was = before[i];
        if (was !== null) t.setAttribute("content", was);
      });
    };
  }, [dark]);

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 !m-0 overflow-hidden"
        style={{
          height: SKY_HEIGHT,
          opacity: `calc(${there})`,
          // clear of any cloud by a third of the way down, and the page colour from there to the bottom edge
          maskImage: "linear-gradient(to bottom, #000 0, #000 30%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0, #000 30%, transparent 100%)",
          // its own colour is the sky's top colour while the sky shows and the page colour once it has gone (what Safari reads for the status bar)
          backgroundColor: `color-mix(in srgb, var(--overview-sky-top) calc(${there} * 100%), var(--background))`,
          backgroundImage: "linear-gradient(to bottom, var(--overview-sky-top), var(--overview-sky-bottom))",
        }}
      >
        <CloudShader className="absolute inset-0 h-full min-h-0" skyTopColor={sky.top} skyBottomColor={sky.bottom} cloudColor={sky.cloud} maxPixelRatio={1} />
      </div>
    </>
  );
}
