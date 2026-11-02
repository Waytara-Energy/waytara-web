"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { ArrowRight, Sun, BatteryCharging, PlugZap, Activity } from "lucide-react";
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
// The big word sits between them, like the clock on a phone's depth-effect wallpaper: the roof hides the foot of it.
const SCENE_RATIO = 2000 / 1116;
// Where the roof's top edge falls in the picture (top of the panels, 515 of 1116 px).
const ROOF_TOP_PCT = 46;

// The four parts that make up the one system (same four as the "Our Approach" visual in the homepage copy).
const SYSTEM_PARTS = [
  { icon: Sun, label: "Solar generation" },
  { icon: BatteryCharging, label: "Battery storage" },
  { icon: PlugZap, label: "EV charging" },
  { icon: Activity, label: "Energy management" },
] as const;

export function Hero() {
  // Same mounted-guard pattern as shared/theme-toggle.tsx: `resolvedTheme`
  // is undefined until after hydration (defaultTheme="system" in
  // layout.tsx), so we can't pick light/dark art on the server render.
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const [isDark, setIsDark] = React.useState(false);
  const sectionRef = React.useRef<HTMLElement>(null);

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

  // Depth: the big word drifts a few pixels against the house as the pointer moves, so it reads as sitting behind it.
  // Skipped for touch screens and for visitors who ask for less motion. Writes CSS variables, so React never re-renders.
  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduce) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", String(((e.clientX - r.left) / r.width - 0.5) * 2));
      el.style.setProperty("--py", String(((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

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

  return (
    // container-type:size lets the scene below be sized from the hero's own width and height (cqw / cqh), like object-fit: cover.
    <section
      ref={sectionRef}
      className="relative w-full h-[100dvh] min-h-[640px] [container-type:size] overflow-hidden select-none bg-black"
      style={{ "--px": 0, "--py": 0 } as React.CSSProperties}
    >
      {/* 1. The scene: photo, big word and house cut-out, all in one box with the picture's own proportions */}
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

        {/* The big word, behind the house: crisp white, its foot hidden by the roof. Decorative; the real headline is the h1 below. */}
        <Reveal
          direction="up"
          delay={150}
          duration={1000}
          distance={40}
          aria-hidden="true"
          className="absolute inset-x-0 z-10 flex justify-center px-4 text-center text-[min(10.4cqw,max(16vw,3rem))]"
          style={{ bottom: `calc(${100 - ROOF_TOP_PCT}% - 0.34em)` }}
        >
          <span
            className="block font-black uppercase leading-[0.85] tracking-tight text-balance text-white/95 transition-transform duration-300 ease-out will-change-transform"
            style={{ transform: "translate3d(calc(var(--px) * -14px), calc(var(--py) * -8px), 0)" }}
          >
            One System
          </span>
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
      <div className="absolute inset-x-0 top-0 z-30 h-32 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 z-30 h-[58%] sm:h-[48%] bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* 3. The headline, top left under the nav */}
      <div className="absolute inset-x-0 top-0 z-40 px-[var(--page-gutter)] pt-24 sm:pt-28 lg:pt-32">
        <div className="mx-auto max-w-7xl">
          <Reveal direction="up" delay={250} duration={850} distance={24}>
            <h1 className="max-w-[18rem] sm:max-w-md text-left text-[clamp(1.6rem,2.7vw,2.6rem)] font-semibold leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,20,60,0.4)]">
              Your property&rsquo;s energy, built as one system.
            </h1>
          </Reveal>
        </div>
      </div>

      {/* 4. Bottom row: what WayTara does (left), what to do next (centre), what the system is made of (right) */}
      <div className="absolute inset-x-0 bottom-0 z-40 px-[var(--page-gutter)] pb-8 sm:pb-10">
        <div className="mx-auto max-w-7xl flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-end lg:gap-8">
          <Reveal direction="up" delay={450} duration={850} distance={20} className="max-w-md text-left">
            <p className="text-[clamp(1.05rem,1.6vw,1.45rem)] font-semibold leading-snug text-white">
              Solar, battery storage and EV charging, designed, installed and managed together.
            </p>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-white/75">
              Lower bills, reliable power, and one team to call.
            </p>
          </Reveal>

          <Reveal direction="zoom" delay={650} duration={800}>
            <div className="flex flex-col items-start lg:items-center gap-4">
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

          <Reveal direction="left" delay={800} duration={850} distance={30} className="hidden lg:block justify-self-end">
            <div className="w-[14.5rem] rounded-2xl border border-white/25 bg-white/10 p-3.5 text-left shadow-2xl shadow-black/20 backdrop-blur-md">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/70">One integrated system</p>
              <ul className="mt-2.5 divide-y divide-white/15">
                {SYSTEM_PARTS.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0 text-sm font-medium text-white">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-emerald-200">
                      <Icon className="size-3.5" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
