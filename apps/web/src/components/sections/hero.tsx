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
    <section className="relative w-full min-h-[100dvh] flex flex-col justify-start items-center text-center overflow-hidden select-none bg-black px-[var(--page-gutter)] pt-24 pb-20 sm:pb-24">
      
      {/* 1. Full-Bleed Background Video - Shifted down so top arc sits towards the center */}
      <div className="absolute inset-0 z-0 w-full h-full overflow-hidden flex items-center justify-center bg-black">
        {TEMP_USE_HERO_TEST_IMAGE ? (
          <>
            {/* Day image is always the base layer; the night image
                crossfades in on top of it — smoother than swapping `src`
                (which would pop/reload) and avoids a blank gap mid-toggle. */}
            <Image
              src="/images/hero-bg-light-v3.webp"
              alt=""
              fill
              priority
              className="object-cover pointer-events-none"
            />
            <Image
              src="/images/hero-bg-dark-v2.png"
              alt=""
              fill
              priority
              className={cn(
                "object-cover pointer-events-none transition-opacity duration-[1200ms] ease-in-out",
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
            className="w-full h-full min-w-full min-h-full object-cover pointer-events-none translate-y-[14%] sm:translate-y-[18%] lg:translate-y-[22%] scale-110 sm:scale-115 transition-transform duration-500"
          >
            <source src="/videos/hero-bg.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}

        {/* Subtle Vignette Gradient Overlay for Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/60 pointer-events-none" />
      </div>

      {/* 2. Content: sits in the open sky above the house, so the roof stays clear */}
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">

        <Reveal direction="up" delay={150} duration={850} distance={28}>
          <h1 className="text-[clamp(2.1rem,4.2vw,3.9rem)] font-semibold tracking-tight leading-[1.08] text-white text-balance drop-shadow-lg">
            <span className="block sm:whitespace-nowrap">Your property&rsquo;s energy,</span>
            <span className="block sm:whitespace-nowrap">built as one system.</span>
          </h1>
        </Reveal>

        <Reveal direction="up" delay={350} duration={850} distance={20}>
          <p className="mt-4 sm:mt-5 max-w-2xl text-[clamp(1rem,1.25vw,1.15rem)] leading-relaxed text-white/90 drop-shadow-md">
            Solar, battery storage and EV charging, designed, installed and managed together. Lower bills, reliable power, and one team to call.
          </p>
        </Reveal>

        <Reveal direction="zoom" delay={550} duration={800}>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-7">
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
              className="text-sm sm:text-base font-semibold text-white/95 underline decoration-white/40 underline-offset-[6px] drop-shadow-md transition-colors hover:text-white hover:decoration-white"
            >
              Talk to an engineer
            </Link>
          </div>
        </Reveal>

      </div>

      {/* 3. Subtle Scroll Down Indicator at bottom center */}
      <Reveal
        direction="fade"
        delay={1000}
        duration={900}
        className="absolute bottom-5 sm:bottom-7 left-1/2 -translate-x-1/2 z-10"
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
