"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DemoInitial } from "@/components/sections/demo-monitoring";

// The dashboard's own page is loaded only here, only when a slide is on show, and after the page has painted (it brings the charts with it).
const DemoMonitoring = dynamic(() => import("@/components/sections/demo-monitoring").then((m) => m.DemoMonitoring), { ssr: false });

const DEMO_WIDTH = 1180;
const DEMO_HEIGHT = 640;
/** The height the phone layout is drawn at; the room it has clips it, so only its upper part shows. */
const PHONE_HEIGHT = 700;
export const SLIDE_MS = 7500;
/** How much wider than the room it has the window is drawn, so its right edge runs off the panel. */
const BLEED = 1.06;
/**
 * The logo, the heading, the sentence and the bars start where the text of the dashboard's first tab (Main Hub) starts, not at the window's outer edge. How far in that
 * is depends on the window's scale and on the page's root font size (which grows with the screen), so the window measures it and reports it in the --edge variable;
 * the number after the comma is only what is used for the first paint. The base padding (4 rem, 5 rem on wide screens) is the window's own left edge.
 */
const EDGE = "pl-[calc(4rem+var(--edge,17px))] xl:pl-[calc(5rem+var(--edge,17px))]";
/** In the window's own units: its border (2 px), the page padding (1.5 rem) and the tab's padding (0.25 rem) before the first tab's text. */
const TAB_TEXT_INSET = { px: 2, rem: 1.75 };

interface Slide {
  /** The two lines of the heading: the second is in the brand green. */
  title: string;
  accent: string;
  body: string;
  initial: DemoInitial;
}

/** Five things the application does, each shown on the application itself (made-up figures, following the clock). */
const SLIDES: Slide[] = [
  {
    title: "See everything,",
    accent: "live.",
    body: "Solar, battery, grid, load and your EV charger on one screen, updating as it happens.",
    initial: { tab: "hub" },
  },
  {
    title: "Know the moment",
    accent: "something needs you.",
    body: "Faults, warnings and good news land in one place, so nothing waits unseen.",
    initial: { panel: "bell", alert: 0 },
  },
  {
    title: "Run your EV charger",
    accent: "from anywhere.",
    body: "Start or stop a charge, and see what is powering it and what it has delivered today.",
    initial: { tab: "ev-home" },
  },
  {
    title: "Every site,",
    accent: "one login.",
    body: "Homes, buildings and charging sites, each one tap away, without signing in again.",
    initial: { site: "hub", tab: "hub-1", panel: "site" },
  },
  {
    title: "The weather,",
    accent: "built in.",
    body: "See what the sky means for your solar before the day gets going.",
    initial: { panel: "weather" },
  },
];

/** True from the first render after the page loads when the screen matches the query. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const q = window.matchMedia(query);
    const sync = () => setMatches(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

export function useReducedMotion(): boolean {
  const [still, setStill] = React.useState(false);
  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void Promise.resolve().then(() => setStill(reduce));
  }, []);
  return still;
}

/**
 * The application as a straight window, scaled to the room it has and drawn wider and taller than that, so its right edge and its bottom run off the panel and
 * only its upper left shows. On a phone it is the phone layout at its own size instead. It is a picture: nothing in it can be clicked.
 */
function Preview({ initial, phone = false, onEdge }: { initial: DemoInitial; phone?: boolean; /** Called with how far in, in pixels, the first tab's text is from the window's left edge. */ onEdge?: (px: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width && height) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = phone ? 1 : size ? (size.w * BLEED) / DEMO_WIDTH : 0;
  React.useEffect(() => {
    if (!onEdge || !scale) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    onEdge((TAB_TEXT_INSET.px + TAB_TEXT_INSET.rem * rem) * scale);
  }, [onEdge, scale]);

  if (phone) {
    return (
      <div ref={ref} className="pointer-events-none relative h-full select-none" aria-hidden="true">
        {size && (
          <div
            className="absolute left-0 top-0 rounded-tl-[36px] border-[2px] border-r-0 border-b-0 border-black/20 bg-background dark:border-white/25"
            style={{ width: size.w, height: PHONE_HEIGHT }}
          >
            <div className="h-full w-full overflow-hidden rounded-tl-[34px] pt-3" style={{ clipPath: "inset(0 round 34px 0 0 0)" }}>
              <DemoMonitoring locked mobile initial={initial} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const height = size ? Math.max(DEMO_HEIGHT, size.h / scale + 80) : DEMO_HEIGHT;
  return (
    <div ref={ref} className="pointer-events-none relative h-full select-none" aria-hidden="true">
      {size && (
        <div
          className="absolute left-0 top-0 rounded-tl-[56px] border-[2px] border-r-0 border-b-0 border-black/20 bg-background dark:border-white/25"
          style={{ width: DEMO_WIDTH, height, transform: `scale(${scale})`, transformOrigin: "left top" }}
        >
          {/* no shadow (it smudged grey round the curve and was cut off by the panel's edge); the inside is cut to the border's own inner curve, 56 px minus the 2 px border */}
          <div className="h-full w-full overflow-hidden rounded-tl-[54px] pt-5" style={{ clipPath: "inset(0 round 54px 0 0 0)" }}>
            <DemoMonitoring locked initial={initial} />
          </div>
        </div>
      )}
    </div>
  );
}

/** One bar for each slide: the bar of the slide on show fills as its time runs (or is full, when nothing advances by itself). */
export function SlideBars({ slides, index, setIndex, paused, still, holdLast }: { slides: { title: string; accent: string }[]; index: number; setIndex: (i: number) => void; paused: boolean; still: boolean; holdLast?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {slides.map((s, i) => {
        const full = i < index || (i === index && (still || (holdLast && i === slides.length - 1)));
        return (
          <button
            key={s.title}
            type="button"
            aria-label={`Show: ${s.title} ${s.accent}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className="group relative h-6 w-10 cursor-pointer outline-none sm:w-14"
          >
            <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-theme-border transition-colors group-hover:bg-theme-muted/60 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500">
              {full ? (
                <span className="absolute inset-0 rounded-full bg-emerald-500" />
              ) : i === index ? (
                <span key={`bar${index}`} className="login-progress absolute inset-0 rounded-full bg-emerald-500" style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running" }} />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The left half of the sign-in page, edge to edge, plain white or black like the rest of the site: the logo, one idea at a time (a heading and a sentence),
 * and the application as a straight window running off the corner. Five slides advance by themselves with
 * a bar for each that fills as its time runs; they stop while the pointer is over the panel and do not move at all for visitors who ask for less motion.
 * It shows only on a wide screen; on a phone the same five slides come first, in LoginFlow.
 */
export function LoginShowcase() {
  const wide = useMedia("(min-width: 1024px)");
  const still = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [edge, setEdge] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!wide || paused || still) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [wide, paused, still, index]);

  const slide = SLIDES[index];
  return (
    <div
      className="relative hidden w-1/2 flex-col overflow-hidden bg-theme-bg lg:flex"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={edge === null ? undefined : ({ "--edge": `${edge}px` } as React.CSSProperties)}
    >
      <div className={cn("relative pr-16 pt-20 xl:pr-20 xl:pt-24", EDGE)}>
        <Logo />
      </div>

      <div key={index} className={cn("login-slide relative mt-10 pr-16 xl:pr-20", EDGE)}>
        <h2 className="max-w-xl text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.1] tracking-tight text-theme-primary" aria-live="polite">
          {slide.title}
          <span className="block text-primary-gradient">{slide.accent}</span>
        </h2>
        <p className="mt-4 max-w-md text-[clamp(1rem,1.2vw,1.125rem)] leading-snug text-theme-secondary">{slide.body}</p>
      </div>

      <div key={`p${index}`} className="login-slide-late relative mt-8 min-h-0 flex-1 overflow-hidden pl-16 xl:pl-20">
        {wide && <Preview initial={slide.initial} onEdge={setEdge} />}
      </div>

      <div className={cn("absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-theme-bg via-theme-bg/90 to-transparent pb-7 pt-16 pr-16 xl:pr-20", EDGE)}>
        <SlideBars slides={SLIDES} index={index} setIndex={setIndex} paused={paused} still={still} />
      </div>
    </div>
  );
}

/**
 * On a phone the five slides come first, one screen each, with the application's phone layout under the words. Next moves on (so does a swipe, and the first four
 * advance by themselves); Skip, or Next on the last slide, goes to the sign-in form. Nothing here shows on a wide screen.
 */
function MobileIntro({ onDone }: { onDone: () => void }) {
  const narrow = useMedia("(max-width: 1023px)");
  const still = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const touchX = React.useRef<number | null>(null);
  const last = index === SLIDES.length - 1;

  React.useEffect(() => {
    if (!narrow || still || last) return;
    const id = window.setTimeout(() => setIndex((i) => Math.min(i + 1, SLIDES.length - 1)), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [narrow, still, last, index]);

  const slide = SLIDES[index];
  return (
    <div
      className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-theme-bg lg:hidden"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start === null || end === undefined) return;
        if (start - end > 50) (last ? onDone : () => setIndex(index + 1))();
        else if (end - start > 50) setIndex(Math.max(0, index - 1));
      }}
    >
      <div className="flex items-center justify-between pl-[calc(2.75rem+2px)] pr-6 pt-10">
        <Logo />
        <button type="button" onClick={onDone} className="-mr-2 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-theme-secondary transition-colors hover:text-theme-primary">
          Skip
        </button>
      </div>

      <div key={index} className="login-slide relative mt-10 pl-[calc(2.75rem+2px)] pr-6">
        <h2 className="text-[clamp(1.9rem,9vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-theme-primary" aria-live="polite">
          {slide.title}
          <span className="block text-primary-gradient">{slide.accent}</span>
        </h2>
        <p className="mt-3 max-w-sm text-base leading-snug text-theme-secondary">{slide.body}</p>
      </div>

      <div key={`p${index}`} className="login-slide-late relative mt-7 min-h-[320px] flex-1 overflow-hidden pl-6">
        {narrow && <Preview phone initial={slide.initial} />}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-theme-bg via-theme-bg/90 to-transparent pb-6 pl-[calc(2.75rem+2px)] pr-6 pt-16">
        <SlideBars slides={SLIDES} index={index} setIndex={setIndex} paused={false} still={still} holdLast />
        <Button type="button" onClick={() => (last ? onDone() : setIndex(index + 1))} className="gap-1.5">
          {last ? "Log in" : "Next"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The sign-in page's right column, which on a phone comes after the slides: the slides first (unless the visitor arrives from a sign-in that did not work, or with an
 * e-mail already filled in, and needs the form at once), then the form. On a wide screen the form is always there.
 */
export function LoginFlow({ skipIntro, children }: { skipIntro: boolean; children: React.ReactNode }) {
  const [intro, setIntro] = React.useState(!skipIntro);
  return (
    <>
      {intro && <MobileIntro onDone={() => setIntro(false)} />}
      <div className={cn("w-full flex-col lg:flex lg:w-1/2", intro ? "hidden" : "flex")}>{children}</div>
    </>
  );
}
