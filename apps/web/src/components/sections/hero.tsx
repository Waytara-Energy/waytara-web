"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { CloudShader } from "@/components/ui/cloud-shader";
import { TEMP_HIDE_LANDING_SECTIONS } from "@/config/landing-flags";
import { cn } from "@/lib/utils";
import { useHasMounted } from "@/hooks/use-has-mounted";

// The sky is a live cloud shader and the house is a cut-out photo (transparent sky) standing in front of it. The cut-out is 2000 x 1116.
// It is laid out like object-fit: cover, anchored to the bottom, so the headline can be centred in the open sky between the nav and the
// roof's top edge, wherever that edge ends up on the screen.
const SCENE_RATIO = 2000 / 1116;
// Where the roof's top edge falls in the picture (top of the panels, 515 of 1116 px).
const ROOF_TOP_PCT = 46;

// The shader's colours: the day sky and, in the dark theme, the same scene at dusk.
const SKY_DAY = { top: "#3876ba", bottom: "#8cbfe8", cloud: "#fbf8f2" };
const SKY_DUSK = { top: "#070d1f", bottom: "#1b2a4a", cloud: "#8d9bb8" };
// Height of the fixed nav bar; the sky gap starts below it.
const NAV_HEIGHT = "4.5rem";
export function Hero() {
  // Same mounted-guard pattern as shared/theme-toggle.tsx: `resolvedTheme`
  // is undefined until after hydration (defaultTheme="system" in
  // layout.tsx), so we can't pick light/dark art on the server render.
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const [isDark, setIsDark] = React.useState(false);

  // layout.tsx's ThemeProvider sets `disableTransitionOnChange`, which
  // briefly force-disables ALL CSS transitions site-wide (via an injected
  // `* { transition: none }` stylesheet) during a theme switch, so every
  // themed element swaps color instantly instead of cross-fading. If we
  // drove the crossfade straight off `resolvedTheme`, our opacity change
  // would land inside that disabled window and jump instantly too — so we
  // wait a beat past it before flipping, which is enough for next-themes
  // to have already lifted its override and our own transition to
  // actually animate. A plain timeout, not requestAnimationFrame — rAF
  // only fires while the tab is actively painting frames, and won't run
  // at all in a backgrounded/inactive tab.
  React.useEffect(() => {
    if (!mounted) return;
    const target = resolvedTheme === "dark";
    const timer = setTimeout(() => setIsDark(target), 50);
    return () => clearTimeout(timer);
  }, [resolvedTheme, mounted]);

  // "Plan my system": while the Energy Planner section is hidden
  // (TEMP_HIDE_LANDING_SECTIONS, src/config/landing-flags.ts) there is
  // nothing on this page to jump to, so the button opens the Solutions page,
  // where a visitor can pick a package and book a site assessment. Once the
  // flag flips off it scrolls to the planner again.
  const scrollToPlanner = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("energy-planner")?.scrollIntoView({ behavior: "smooth" });
  };

  // One clear main action: a white pill with a green arrow.
  const primaryButtonClass =
    "group inline-flex h-12 sm:h-[3.25rem] items-center gap-3 rounded-full bg-white pl-6 pr-1.5 text-sm sm:text-base font-semibold text-slate-950 shadow-xl shadow-black/25 transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer";
  const primaryArrow = (
    <span className="flex size-9 sm:size-10 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform duration-200 group-hover:translate-x-0.5">
      <ArrowRight className="size-4" />
    </span>
  );

  const scrollToNextSection = () => {
    // Pre-existing bug, fixed in passing: WhoWeAre's actual DOM id is
    // "about-us" (see who-we-are.tsx), not "who-we-are" — this button
    // silently no-opped before.
    const el = document.getElementById("about-us");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll scene: the hero stays pinned while the page scrolls through SCROLL_TRAVEL extra screens, and --p (0 to 1) says how far along it is.
  // Everything below moves from --p in CSS (no React state, so scrolling never re-renders the page): the headline sinks behind the house, the
  // house moves in towards the visitor, the sky slowly grows, and the bottom text and the scroll cue fade out.
  const outerRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const outer = outerRef.current;
    const scene = sceneRef.current;
    if (!outer || !scene) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // nothing is pinned or moved for these visitors
    let frame = 0;
    const update = () => {
      frame = 0;
      const travel = outer.offsetHeight - scene.offsetHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -outer.getBoundingClientRect().top / travel)) : 0;
      scene.style.setProperty("--p", p.toFixed(4));
      scene.dataset.past = p > 0.3 ? "1" : "0"; // the bottom row is invisible from here on, so it must not catch clicks either
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    // The outer box is taller than the screen; the scene sticks to the top of it while that extra height scrolls by.
    // (85dvh of extra scrolling, written out in full so Tailwind can see the class; none for visitors who ask for less motion.)
    <div ref={outerRef} className="relative h-[calc(max(100dvh,620px)+85dvh)] motion-reduce:h-[max(100dvh,620px)]">
    {/* container-type:size lets the scene below be sized from the hero's own width and height (cqw / cqh), like object-fit: cover. */}
    <section
      ref={sceneRef}
      className="group sticky top-0 w-full h-[100dvh] min-h-[620px] [--p:0] [container-type:size] overflow-hidden select-none bg-[#3876ba]"
    >
      {/* 1a. The sky: drifting clouds drawn live (the colour behind it shows if the browser has no WebGL). It grows a little as you scroll. */}
      <div className="absolute inset-0 will-change-transform" style={{ scale: "calc(1 + var(--p) * 0.12)" }}>
        <CloudShader
          className="absolute inset-0 h-full min-h-0 bg-gradient-to-b from-[#3876ba] to-[#8cbfe8]"
          skyTopColor={isDark ? SKY_DUSK.top : SKY_DAY.top}
          skyBottomColor={isDark ? SKY_DUSK.bottom : SKY_DAY.bottom}
          cloudColor={isDark ? SKY_DUSK.cloud : SKY_DAY.cloud}
          maxPixelRatio={1}
        />
      </div>

      {/* 1b. The house, in a box with the picture's own proportions (cover, anchored to the bottom), in front of the sky and of the headline.
          Scrolling brings it towards you (it grows from its foot), which lifts the roof over the headline. */}
      <div
        className="absolute bottom-0 left-1/2 z-[25] -translate-x-1/2 will-change-transform [container-type:inline-size]"
        style={{
          width: `max(100cqw, calc(100cqh * ${SCENE_RATIO.toFixed(4)}))`,
          aspectRatio: "2000 / 1116",
          scale: "calc(1 + var(--p) * 0.14)",
          transformOrigin: "50% 100%",
        }}
      >
        {/* Dark theme: the same house, dimmed and cooled to dusk (so the house and the layout stay the same). */}
        <Image
          src="/images/hero-house-cutout.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn(
            "object-cover pointer-events-none transition-[filter] duration-[1200ms] ease-in-out",
            isDark && "brightness-[0.5] saturate-[0.8] hue-rotate-[8deg]"
          )}
        />
      </div>

      {/* The headline: centred in the open sky, between the nav and the roof's top edge. The last line fades towards its foot.
          Scrolling lowers it, shrinks it a little (it recedes) and, once it is behind the roof, fades it out. */}
      <div
        className="absolute inset-x-0 z-20 flex items-center justify-center px-4 text-center will-change-transform"
        style={{
          top: NAV_HEIGHT,
          // sky gap = roof top (hero height minus the part of the picture below the roof's edge) minus the nav
          height: `calc(100cqh - ${((100 - ROOF_TOP_PCT) / 100).toFixed(2)} * max(${(100 / SCENE_RATIO).toFixed(2)}cqw, 100cqh) - ${NAV_HEIGHT})`,
          transform: "translateY(calc(var(--p) * 46cqh)) scale(calc(1 - var(--p) * 0.2))",
          opacity: "calc(1 - max(0, var(--p) - 0.7) * 3.4)",
        }}
      >
        <Reveal direction="up" delay={150} duration={900} distance={30}>
          <h1 className="font-bold tracking-tight leading-[1.05] text-white text-balance text-[clamp(2rem,4.6vw,7rem)]">
            <span className="block sm:whitespace-nowrap drop-shadow-[0_2px_14px_rgba(0,20,60,0.35)]">Your property&rsquo;s energy,</span>
            <span className="block sm:whitespace-nowrap bg-gradient-to-b from-white via-white/75 to-white/15 bg-clip-text text-transparent">built as one system.</span>
          </h1>
        </Reveal>
      </div>

      {/* 2. Soft shading so the nav and the bottom text stay readable (the bottom one fades as the text does) */}
      <div className="absolute inset-x-0 top-0 z-30 h-28 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
      <div
        className="absolute inset-x-0 bottom-0 z-30 h-[55%] sm:h-[48%] bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"
        style={{ opacity: "calc(1 - var(--p) * 0.7)" }}
      />

      {/* 3. Bottom row: what WayTara does (left) and what to do next (right). It slides down and fades out in the first part of the scroll. */}
      <div
        className="absolute inset-x-0 bottom-0 z-40 pb-8 sm:pb-12 group-data-[past=1]:pointer-events-none"
        style={{ opacity: "calc(1 - var(--p) * 2.8)", transform: "translateY(calc(var(--p) * 9cqh))" }}
      >
        {/* the same width and side gutter as the nav and every section below, so the edges line up */}
        <div className="fluid-container flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal direction="up" delay={400} duration={850} distance={20} className="max-w-xl text-left">
            <p className="text-[clamp(1.1rem,1.8vw,1.65rem)] font-semibold leading-snug text-white">
              Solar, battery storage and EV charging, designed, installed and managed together.
            </p>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-white/75">
              Lower bills, reliable power, and one team to call.
            </p>
          </Reveal>

          <Reveal direction="zoom" delay={600} duration={800}>
            <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 sm:gap-7">
              {TEMP_HIDE_LANDING_SECTIONS ? (
                <Link href="/solutions" className={primaryButtonClass}>
                  <span>Plan my system</span>
                  {primaryArrow}
                </Link>
              ) : (
                <button type="button" onClick={scrollToPlanner} className={primaryButtonClass}>
                  <span>Plan my system</span>
                  {primaryArrow}
                </button>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      {/* 4. Subtle Scroll Down Indicator at bottom center (large screens, where the bottom row leaves room) */}
      <Reveal
        direction="fade"
        delay={1000}
        duration={900}
        className="hidden lg:block absolute bottom-3 left-1/2 -translate-x-1/2 z-40"
      >
        <button
          onClick={scrollToNextSection}
          className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors cursor-pointer focus:outline-none group-data-[past=1]:pointer-events-none"
          style={{ opacity: "calc(1 - var(--p) * 6)" }}
          aria-label="Scroll to Who We Are"
        >
          <ChevronDown className="h-5 w-5 lg:h-6 lg:w-6 animate-bounce" />
        </button>
      </Reveal>
    </section>
    </div>
  );
}
