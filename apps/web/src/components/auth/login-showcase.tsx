"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Bell, CircleCheck, CloudSun, MapPin, Zap, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import type { DemoInitial } from "@/components/sections/demo-monitoring";

// The dashboard's own page is loaded only here, only on a wide screen, and after the page has painted (it brings the charts with it).
const DemoMonitoring = dynamic(() => import("@/components/sections/demo-monitoring").then((m) => m.DemoMonitoring), { ssr: false });

const DEMO_WIDTH = 1180;
const DEMO_HEIGHT = 640;
const SLIDE_MS = 7500;
/** How much wider than the room it has the window is drawn, so its right edge runs off the panel. */
const BLEED = 1.06;

interface Slide {
  /** The two lines of the heading: the second is in the brand green. */
  title: string;
  accent: string;
  body: string;
  /** A small card floating over the picture, saying the one thing to notice. */
  callout: { icon: LucideIcon; title: string; text: string };
  initial: DemoInitial;
}

/** Five things the application does, each shown on the application itself (made-up figures, following the clock). */
const SLIDES: Slide[] = [
  {
    title: "See everything,",
    accent: "live.",
    body: "Solar, battery, grid, load and your EV charger on one screen, updating as it happens.",
    callout: { icon: CircleCheck, title: "All devices online", text: "Inverter and charger reporting" },
    initial: { tab: "hub" },
  },
  {
    title: "Know the moment",
    accent: "something needs you.",
    body: "Faults, warnings and good news land in one place, so nothing waits unseen.",
    callout: { icon: Bell, title: "Every alert, one place", text: "Faults, actions, warnings, good news" },
    initial: { panel: "bell", alert: 0 },
  },
  {
    title: "Run your EV charger",
    accent: "from anywhere.",
    body: "Start or stop a charge, and see what is powering it and what it has delivered today.",
    callout: { icon: Zap, title: "Charge on sunshine", text: "See how much of it is solar" },
    initial: { tab: "ev-home" },
  },
  {
    title: "Every site,",
    accent: "one login.",
    body: "Homes, buildings and charging sites, each one tap away, without signing in again.",
    callout: { icon: MapPin, title: "Charging Hub", text: "Four chargers, one login" },
    initial: { site: "hub", tab: "hub-1", panel: "site" },
  },
  {
    title: "The weather,",
    accent: "built in.",
    body: "See what the sky means for your solar before the day gets going.",
    callout: { icon: CloudSun, title: "Forecast built in", text: "Plan around the sky" },
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
          className="absolute left-0 top-0 rounded-tl-[56px] border-[2px] border-r-0 border-b-0 border-black/15 bg-background shadow-[0_30px_80px_-30px_rgba(15,23,42,0.3)] dark:border-white/20 dark:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
          style={{ width: DEMO_WIDTH, height, transform: `scale(${scale})`, transformOrigin: "left top" }}
        >
          {/* the corner is cut by the clip path as well as by the radius: a tilted, scaled window with charts in it can otherwise show square corners */}
          <div className="h-full w-full overflow-hidden rounded-tl-[56px]" style={{ clipPath: "inset(0 round 56px 0 0 0)" }}>
            <DemoMonitoring locked initial={initial} />
          </div>
        </div>
      )}
    </div>
  );
}

const PHONE_WIDTH = 236;
const PHONE_SCREEN = PHONE_WIDTH - 12;
const PHONE_DESIGN = 390;

/** The same view in the phone layout, in a phone: it floats beside the window, lower and to the right, and runs off the bottom of the panel like it. */
function Phone({ initial }: { initial: DemoInitial }) {
  return (
    <div
      aria-hidden="true"
      className="login-float-slow pointer-events-none absolute right-8 top-[40%] z-10 rounded-[2.5rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-[0_30px_70px_-22px_rgba(15,23,42,0.55)] dark:border-neutral-600 dark:bg-neutral-600 dark:shadow-[0_30px_70px_-22px_rgba(0,0,0,0.95)]"
      style={{ width: PHONE_WIDTH }}
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-background" style={{ width: PHONE_SCREEN, height: 760 }}>
        <div style={{ width: PHONE_DESIGN, height: 760 / (PHONE_SCREEN / PHONE_DESIGN), transform: `scale(${PHONE_SCREEN / PHONE_DESIGN})`, transformOrigin: "top left" }}>
          <DemoMonitoring locked mobile initial={initial} />
        </div>
      </div>
    </div>
  );
}

/**
 * The left half of the sign-in page, edge to edge, plain white or black like the rest of the site: the logo, one idea at a time (a heading and a sentence),
 * and the application as a straight window running off the corner, with the same view in a phone floating beside it and one small card floating over both. Five slides advance by themselves with
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
  const Callout = slide.callout.icon;
  return (
    <div
      className="relative hidden w-1/2 flex-col overflow-hidden bg-theme-bg lg:flex"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative px-12 pt-9 xl:px-16">
        <Logo />
      </div>

      <div key={index} className="login-slide relative mt-10 px-12 xl:px-16">
        <h2 className="max-w-xl text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.1] tracking-tight text-theme-primary" aria-live="polite">
          {slide.title}
          <span className="block text-primary-gradient">{slide.accent}</span>
        </h2>
        <p className="mt-4 max-w-md text-[clamp(1rem,1.2vw,1.125rem)] leading-snug text-theme-secondary">{slide.body}</p>
      </div>

      <div key={`p${index}`} className="login-slide-late relative mt-8 min-h-0 flex-1 overflow-hidden pl-12 xl:pl-16">
        {wide && <Preview initial={slide.initial} />}
        {wide && <Phone initial={slide.initial} />}

        {/* the one thing to notice, floating over the picture */}
        <div className="login-float pointer-events-none absolute bottom-24 left-16 z-20 flex items-center gap-3 rounded-2xl border border-theme-border bg-theme-bg/90 py-3 pl-3 pr-5 shadow-[0_18px_40px_-14px_rgba(15,23,42,0.35)] backdrop-blur dark:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.8)]">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Callout className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-theme-primary">{slide.callout.title}</span>
            <span className="block text-xs text-theme-secondary">{slide.callout.text}</span>
          </span>
        </div>
      </div>

      {/* one bar for each slide: the bar of the slide on show fills as its time runs */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-theme-bg via-theme-bg/90 to-transparent px-12 pb-7 pt-16 xl:px-16">
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
