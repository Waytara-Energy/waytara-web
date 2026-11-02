"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { TEMP_HIDE_LANDING_SECTIONS } from "@/config/landing-flags";
import { cn } from "@/lib/utils";
import { useHasMounted } from "@/hooks/use-has-mounted";

// TEMPORARY — requested 2026-09-07 to trial theme-aware static hero images
// in place of the background video, without touching the video itself.
// Flip back to `false` (or delete this const + its one `if` below) to
// instantly restore the video; nothing about the video markup/source has
// been removed.
const TEMP_USE_HERO_TEST_IMAGE = true;

// The photo and the cut-out of the house are the same 2000 x 1116 picture, so the cut-out lines up with the photo exactly.
// The headline sits between them: the roof hides the foot of its last line, which gives the "text behind the house" depth.
const SCENE_RATIO = 2000 / 1116;
// Where the roof's top edge falls in the picture (top of the panels, 515 of 1116 px).
const ROOF_TOP_PCT = 46;

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

  // One clear main action (a white pill with a green arrow) and one quiet link.
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

  return (
    // container-type:size lets the scene below be sized from the hero's own width and height (cqw / cqh), like object-fit: cover.
    <section className="relative w-full h-[100dvh] min-h-[620px] [container-type:size] overflow-hidden select-none bg-black">
      {/* 1. The scene: photo, headline and house cut-out, all in one box with the picture's own proportions */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 [container-type:inline-size]"
        style={{ width: `max(100cqw, calc(100cqh * ${SCENE_RATIO.toFixed(4)}))`, aspectRatio: "2000 / 1116" }}
      >
        {TEMP_USE_HERO_TEST_IMAGE ? (
          <>
            <Image src="/images/hero-bg-light-v3.webp" alt="" fill priority sizes="100vw" className="object-cover pointer-events-none" />
            {/* Dark theme: a night sky fades in over the photo (and its house); the cut-out house is dimmed to match. */}
            <div
              aria-hidden="true"
              className={cn(
                "absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0b1f40] to-[#1b3a68] pointer-events-none transition-opacity duration-[1200ms] ease-in-out",
                isDark ? "opacity-100" : "opacity-0"
              )}
            />
          </>
        ) : (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          >
            <source src="/videos/hero-bg.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}

        {/* The headline: big, centred, its last line dipping behind the roof */}
        <Reveal
          direction="up"
          delay={150}
          duration={900}
          distance={30}
          className="absolute inset-x-0 z-10 flex justify-center px-4 text-center text-[min(5.6cqw,max(7vw,2.1rem))]"
          style={{ bottom: `calc(${100 - ROOF_TOP_PCT}% - 0.27em)` }}
        >
          <h1 className="font-extrabold tracking-tight leading-[0.98] text-white text-balance drop-shadow-[0_4px_24px_rgba(0,20,60,0.35)]">
            <span className="block sm:whitespace-nowrap">Your property&rsquo;s energy,</span>
            <span className="block sm:whitespace-nowrap">built as one system.</span>
          </h1>
        </Reveal>

        {TEMP_USE_HERO_TEST_IMAGE && (
          <Image
            src="/images/hero-house-cutout.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className={cn(
              "z-20 object-cover pointer-events-none transition-[filter] duration-[1200ms] ease-in-out",
              isDark && "brightness-[0.55] saturate-[0.85]"
            )}
          />
        )}
      </div>

      {/* 2. Soft shading so the nav and the bottom text stay readable */}
      <div className="absolute inset-x-0 top-0 z-30 h-28 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 z-30 h-[55%] sm:h-[48%] bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* 3. Bottom row: what WayTara does (left) and what to do next (right) */}
      <div className="absolute inset-x-0 bottom-0 z-40 px-[var(--page-gutter)] pb-8 sm:pb-12">
        <div className="mx-auto max-w-7xl flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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

              <Link
                href="/contact"
                className="text-sm sm:text-base font-semibold text-white/95 underline decoration-white/40 underline-offset-[6px] transition-colors hover:text-white hover:decoration-white"
              >
                Talk to an engineer
              </Link>
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
          className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors cursor-pointer focus:outline-none"
          aria-label="Scroll to Who We Are"
        >
          <ChevronDown className="h-5 w-5 lg:h-6 lg:w-6 animate-bounce" />
        </button>
      </Reveal>
    </section>
  );
}
