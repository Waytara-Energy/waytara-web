"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { ChevronDown, PhoneCall, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const primaryButtonClass =
    "h-11 sm:h-12 lg:h-13 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-green-500 text-white font-semibold text-xs sm:text-sm lg:text-base tracking-wide shadow-lg shadow-emerald-600/30 border-0 transition-all duration-200 hover:scale-105 active:scale-95 group cursor-pointer";

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
    <section className="relative w-full min-h-[100dvh] flex flex-col justify-center items-center text-center overflow-hidden select-none bg-black px-[var(--page-gutter)] pt-24 pb-20 sm:pt-28 sm:pb-24">
      
      {/* 1. Full-Bleed Background Video - Shifted down so top arc sits towards the center */}
      <div className="absolute inset-0 z-0 w-full h-full overflow-hidden flex items-center justify-center bg-black">
        {TEMP_USE_HERO_TEST_IMAGE ? (
          <>
            {/* Day image is always the base layer; the night image
                crossfades in on top of it — smoother than swapping `src`
                (which would pop/reload) and avoids a blank gap mid-toggle. */}
            <Image
              src="/images/hero-bg-light-v2.png"
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/85 pointer-events-none" />
      </div>

      {/* 2. Vertically & Horizontally Centered Content Lockup */}
      <div className="relative z-10 max-w-5xl 2xl:max-w-6xl mx-auto flex flex-col items-center">

        {/* Eyebrow: what WayTara is, in the visitor's first second */}
        <Reveal direction="fade" delay={100} duration={700}>
          <p className="mb-5 sm:mb-6 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-2xl sm:rounded-full border border-white/15 bg-black/40 px-4 py-2 text-[0.66rem] sm:text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200 backdrop-blur-sm">
            <span>Energy Management System</span>
            <span aria-hidden="true" className="hidden sm:block size-1 rounded-full bg-emerald-300/80" />
            <span>Engineering, Procurement &amp; Construction</span>
          </p>
        </Reveal>

        {/* Headline: two lines on a computer, wraps naturally on a phone */}
        <Reveal direction="up" delay={200} duration={850} distance={28}>
          <h1 className="text-[clamp(1.9rem,3.9vw,4rem)] font-bold tracking-tight leading-[1.2] mx-auto py-1 text-balance">
            <span className="block text-white drop-shadow-md pb-1">Your property&rsquo;s energy,</span>
            <span className="block bg-gradient-to-b from-white via-white/85 to-white/45 bg-clip-text text-transparent drop-shadow-sm pb-2 sm:pb-3">
              designed as one integrated system.
            </span>
          </h1>
        </Reveal>

        {/* Supporting copy */}
        <Reveal direction="up" delay={450} duration={850} distance={20}>
          <div className="mt-2 sm:mt-3 max-w-3xl space-y-3 drop-shadow-md">
            <p className="text-[clamp(0.95rem,1.35vw,1.25rem)] font-medium leading-relaxed text-white/90">
              WayTara designs, builds and manages custom energy systems that bring generation, storage, EV charging and intelligent energy management together around your property&rsquo;s needs.
            </p>
            <p className="text-[clamp(0.85rem,1.15vw,1.05rem)] leading-relaxed text-white/85">
              Meet your energy demand, lower your energy costs, and monitor and control your power sources and loads through one integrated system.
            </p>
          </div>
        </Reveal>

        {/* Centered Dual Action Buttons */}
        <Reveal direction="zoom" delay={700} duration={800}>
          <div className="mt-7 sm:mt-9 lg:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-md lg:max-w-xl">
            {TEMP_HIDE_LANDING_SECTIONS ? (
              <Button asChild size="default" className={primaryButtonClass}>
                <Link href="/solutions" className="inline-flex items-center justify-center gap-2">
                  <span>Plan my system</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            ) : (
              <Button size="default" onClick={scrollToPlanner} className={primaryButtonClass}>
                <span>Plan my system</span>
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
              </Button>
            )}

            <Button
              asChild
              size="default"
              className="h-11 sm:h-12 lg:h-13 rounded-2xl bg-gradient-to-b from-white via-slate-50 to-slate-100 hover:from-slate-100 hover:via-white hover:to-slate-50 text-slate-950 font-semibold text-xs sm:text-sm lg:text-base tracking-wide shadow-xl border-0 transition-all duration-200 hover:scale-105 active:scale-95 group cursor-pointer"
            >
              <Link href="/contact" className="inline-flex items-center justify-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Talk to an engineer</span>
              </Link>
            </Button>
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
