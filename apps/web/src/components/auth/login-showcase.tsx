"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CircleCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import type { DemoInitial } from "@/components/sections/demo-monitoring";
import { cn } from "@/lib/utils";

// The dashboard's own page is loaded only here, only on a wide screen, and after the page has painted (it brings the charts with it).
const DemoMonitoring = dynamic(() => import("@/components/sections/demo-monitoring").then((m) => m.DemoMonitoring), { ssr: false });

const DEMO_WIDTH = 1180;
const DEMO_HEIGHT = 640;
const SLIDE_MS = 7500;

interface Slide {
  title: string;
  body: string;
  /** Three short details of what the picture shows. */
  details: string[];
  initial: DemoInitial;
}

/** Five things the application does, each shown on the application itself (made-up figures, following the clock). */
const SLIDES: Slide[] = [
  {
    title: "See everything, live",
    body: "Solar, battery, grid, load and your EV charger on one screen, updating as it happens.",
    details: ["Power from solar, battery, grid and load", "Your charger beside your inverter", "Today's curves, hour by hour"],
    initial: { tab: "hub" },
  },
  {
    title: "Know the moment something needs you",
    body: "Faults, warnings and good news land in one place, so nothing waits unseen.",
    details: ["Faults, things to act on, things to watch", "Open any alert for what happened and where", "Good news too: reports ready, charges done"],
    initial: { panel: "bell", alert: 0 },
  },
  {
    title: "Run your EV charger from anywhere",
    body: "Start or stop a charge, and see what is powering it and what it has delivered today.",
    details: ["Start and stop a charge", "Power, current, time and what powers it", "Charges, energy and time for the day"],
    initial: { tab: "ev-home" },
  },
  {
    title: "Every site, one login",
    body: "Homes, buildings and charging sites, each one tap away, without signing in again.",
    details: ["Switch sites from the header", "Each site has its own devices and tabs", "Chargers, inverters and meters together"],
    initial: { site: "hub", tab: "hub-1", panel: "site" },
  },
  {
    title: "The weather, built in",
    body: "See what the sky means for your solar before the day gets going.",
    details: ["Temperature, humidity and wind", "The next six hours", "What the sky means for your solar"],
    initial: { panel: "weather" },
  },
];

/** The application, scaled to the width it is given, running out past the bottom of the panel (only its upper half is on show), and not clickable. */
function Preview({ initial }: { initial: DemoInitial }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w) setScale(w / DEMO_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="pointer-events-none relative h-full select-none" aria-hidden="true">
      {scale > 0 && (
        <div
          className="absolute left-0 top-0 overflow-hidden rounded-tl-[52px] border border-r-0 border-b-0 border-theme-border bg-background shadow-[-10px_-6px_50px_-20px_rgba(0,0,0,0.25)]"
          style={{ width: DEMO_WIDTH, height: DEMO_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <DemoMonitoring locked initial={initial} />
        </div>
      )}
    </div>
  );
}

/**
 * The left half of the sign-in page, edge to edge: the logo, one idea at a time with three details under it, and the application itself running out past the
 * panel's right and bottom edges so only its upper half shows. Five slides advance by themselves, stop while the pointer is over the panel, and do not move at
 * all for visitors who ask for less motion. It shows only on a wide screen.
 */
export function LoginShowcase() {
  const [wide, setWide] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (!wide || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [wide, paused, index]);

  const slide = SLIDES[index];
  return (
    <div
      className="relative hidden w-1/2 flex-col overflow-hidden bg-theme-surface lg:flex"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* a soft glow behind the picture */}
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-[-10%] h-[28rem] w-[70%] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative px-12 pt-9 xl:px-16">
        <Logo />
      </div>

      <div key={index} className="login-slide relative mt-8 px-12 xl:px-16">
        <h2 className="max-w-lg text-[clamp(1.7rem,2.5vw,2.4rem)] font-semibold leading-tight tracking-tight text-theme-primary" aria-live="polite">
          {slide.title}
        </h2>
        <p className="mt-3 max-w-lg text-[clamp(1rem,1.25vw,1.15rem)] leading-snug text-theme-muted">{slide.body}</p>
        <ul className="mt-5 space-y-2">
          {slide.details.map((d) => (
            <li key={d} className="flex items-start gap-2.5 text-sm text-theme-secondary">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>

      <div key={`p${index}`} className="login-slide-late relative mt-6 min-h-0 flex-1 overflow-hidden pl-12 xl:pl-16">
        {wide && <Preview initial={slide.initial} />}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-theme-surface via-theme-surface/90 to-transparent px-12 pb-7 pt-16 xl:px-16">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Show: ${s.title}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cn("h-1.5 cursor-pointer rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-emerald-500", i === index ? "w-8 bg-emerald-500" : "w-2.5 bg-theme-border hover:bg-theme-muted")}
          />
        ))}
      </div>
    </div>
  );
}
