"use client";

import * as React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { DemoMonitoring, DEMO_HEIGHT, DEMO_WIDTH } from "./demo-monitoring";
import type { LandingSnapshot } from "@/lib/landing-live";

const POLL_MS = 5_000;
/** The page may stretch a little taller than its design height to use a tall card, but no more. */
const MAX_STRETCH = 1.15;

/** The Waytara Office's live figures, fetched every few seconds while the section is near the screen. */
function useLandingLive(enabled: boolean) {
  const [data, setData] = React.useState<LandingSnapshot | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let stop = false;
    let ctrl: AbortController | null = null;
    const load = async () => {
      if (document.hidden) return;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch("/api/landing/live", { signal: ctrl.signal, cache: "no-store" });
        if (res.ok && !stop) setData((await res.json()) as LandingSnapshot);
      } catch {
        /* keep the last figures; try again on the next beat */
      }
    };
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      stop = true;
      ctrl?.abort();
      window.clearInterval(id);
    };
  }, [enabled]);
  return data;
}

/** The Monitoring page, laid out at its design size and shrunk to fill whatever box it is given. */
function FittedDemo({ data }: { data: LandingSnapshot | null }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState({ scale: 0.7, width: DEMO_WIDTH, height: DEMO_HEIGHT, top: 0 });

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (!width || !height) return;
      const scale = Math.min(width / DEMO_WIDTH, height / DEMO_HEIGHT);
      const laidOutHeight = Math.min(height / scale, DEMO_HEIGHT * MAX_STRETCH);
      setFit({ scale, width: width / scale, height: laidOutHeight, top: Math.max(0, (height - laidOutHeight * scale) / 2) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden rounded-xl bg-background">
      <div style={{ width: fit.width, height: fit.height, transform: `translateY(${fit.top}px) scale(${fit.scale})`, transformOrigin: "top left" }}>
        <DemoMonitoring data={data} />
      </div>
    </div>
  );
}

/**
 * The customer Monitoring page with the Waytara Office's live figures, on a card that tips up and grows as the visitor scrolls
 * (Aceternity's container scroll). Only the page's tabs and sidebar button respond.
 */
export function DashboardShowcase() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const [near, setNear] = React.useState(false);
  const data = useLandingLive(near);

  // Only fetch while the section is on or near the screen.
  React.useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "60% 0px 60% 0px" });
    io.observe(section);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="live-monitoring" aria-label="Live customer monitoring, from the Waytara Office" className="relative z-0 -mt-24 flex flex-col overflow-hidden bg-theme-bg md:-mt-52">
      <ContainerScroll
        titleComponent={
          <>
            <h2 className="text-3xl font-semibold text-theme-primary md:text-5xl">
              Every device, every site <br />
              <span className="text-primary-gradient mt-1 text-4xl font-bold leading-none md:text-[5rem]">in one dashboard.</span>
            </h2>
          </>
        }
      >
        <FittedDemo data={data} />
      </ContainerScroll>
      <p className="-mt-16 px-4 pb-16 text-center text-xs text-theme-secondary sm:text-sm md:-mt-36">
        Live from our Waytara Office: the same Monitoring page our customers use. Try the tabs, or fold the sidebar.
      </p>
    </section>
  );
}
