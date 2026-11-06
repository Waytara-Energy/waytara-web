"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Logo } from "@/components/shared/logo";
import type { DemoInitial } from "@/components/sections/demo-monitoring";

// The dashboard's own page is loaded only here, only on a wide screen, and after the page has painted (it brings the charts with it).
const DemoMonitoring = dynamic(() => import("@/components/sections/demo-monitoring").then((m) => m.DemoMonitoring), { ssr: false });

const DEMO_WIDTH = 1180;
const DEMO_HEIGHT = 640;
const SLIDE_MS = 7500;
/**
 * The logo, the heading, the sentence and the bars start where the dashboard's own content starts (its tabs and cards), not at the window's outer edge: the window
 * has 26 px of border and page padding before its content, and 26 / 1180 of the room it is drawn in is the 0.0234 used in the padding below.
 */
/** How much wider than the room it has the window is drawn, so its right edge runs off the panel. */
const BLEED = 1.06;

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

/**
 * The application as a straight window, scaled to the room it has and drawn wider and taller than that, so its right edge and its bottom run off the panel and
 * only its upper left shows. It is a picture: nothing in it can be clicked.
 */
function Preview({ initial }: { initial: DemoInitial }) {
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
  const scale = size ? (size.w * BLEED) / DEMO_WIDTH : 0;
  const height = size ? Math.max(DEMO_HEIGHT, size.h / scale + 80) : DEMO_HEIGHT;
  return (
    <div ref={ref} className="pointer-events-none relative h-full select-none" aria-hidden="true">
      {size && (
        <div
          className="absolute left-0 top-0 rounded-tl-[56px] border-[2px] border-r-0 border-b-0 border-black/20 bg-background dark:border-white/25"
          style={{ width: DEMO_WIDTH, height, transform: `scale(${scale})`, transformOrigin: "left top" }}
        >
          {/* no shadow (it smudged grey round the curve and was cut off by the panel's edge); the inside is cut to the border's own inner curve, 56 px minus the 2 px border */}
          <div className="h-full w-full overflow-hidden rounded-tl-[54px]" style={{ clipPath: "inset(0 round 54px 0 0 0)" }}>
            <DemoMonitoring locked initial={initial} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The left half of the sign-in page, edge to edge, plain white or black like the rest of the site: the logo, one idea at a time (a heading and a sentence),
 * and the application as a straight window running off the corner. Five slides advance by themselves with
 * a bar for each that fills as its time runs; they stop while the pointer is over the panel and do not move at all for visitors who ask for less motion.
 * It shows only on a wide screen.
 */
export function LoginShowcase() {
  const [wide, setWide] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [still, setStill] = React.useState(false);

  React.useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(q.matches);
    sync();
    q.addEventListener("change", sync);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void Promise.resolve().then(() => setStill(reduce));
    return () => q.removeEventListener("change", sync);
  }, []);

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
    >
      <div className="relative pr-12 pt-14 xl:pr-16 xl:pt-16 pl-[calc(3rem+(50vw-3rem)*0.0234)] xl:pl-[calc(4rem+(50vw-4rem)*0.0234)]">
        <Logo />
      </div>

      <div key={index} className="login-slide relative mt-10 pr-12 xl:pr-16 pl-[calc(3rem+(50vw-3rem)*0.0234)] xl:pl-[calc(4rem+(50vw-4rem)*0.0234)]">
        <h2 className="max-w-xl text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.1] tracking-tight text-theme-primary" aria-live="polite">
          {slide.title}
          <span className="block text-primary-gradient">{slide.accent}</span>
        </h2>
        <p className="mt-4 max-w-md text-[clamp(1rem,1.2vw,1.125rem)] leading-snug text-theme-secondary">{slide.body}</p>
      </div>

      <div key={`p${index}`} className="login-slide-late relative mt-8 min-h-0 flex-1 overflow-hidden pl-12 xl:pl-16">
        {wide && <Preview initial={slide.initial} />}
      </div>

      {/* one bar for each slide: the bar of the slide on show fills as its time runs */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-theme-bg via-theme-bg/90 to-transparent pb-7 pt-16 pr-12 xl:pr-16 pl-[calc(3rem+(50vw-3rem)*0.0234)] xl:pl-[calc(4rem+(50vw-4rem)*0.0234)]">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Show: ${s.title} ${s.accent}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className="group relative h-6 w-14 cursor-pointer outline-none"
          >
            <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-theme-border transition-colors group-hover:bg-theme-muted/60 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500">
              {i < index || (i === index && still) ? (
                <span className="absolute inset-0 rounded-full bg-emerald-500" />
              ) : i === index ? (
                <span key={`bar${index}`} className="login-progress absolute inset-0 rounded-full bg-emerald-500" style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running" }} />
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
