"use client";

import * as React from "react";
import Image from "next/image";
import { DemoMonitoring, DEMO_HEIGHT, DEMO_WIDTH } from "./demo-monitoring";
import type { LandingSnapshot } from "@/lib/landing-live";

const POLL_MS = 5_000;
/** How far the lid is tipped back when closed (a little past flat, so we see its outside). */
const CLOSED_DEG = 92;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The Waytara Office's live figures, fetched every few seconds while the laptop is near the screen. */
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

/**
 * A laptop that opens as the visitor scrolls (the section is taller than the screen and the laptop stays pinned while the lid
 * lifts), showing the customer Monitoring page with the Waytara Office's live figures. Only the page's tabs and sidebar button
 * respond, and only once the lid is open.
 */
export function MacShowcase() {
  const trackRef = React.useRef<HTMLElement>(null);
  const lidRef = React.useRef<HTMLDivElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  const [interactive, setInteractive] = React.useState(false);
  const [near, setNear] = React.useState(false);
  const data = useLandingLive(near);

  // The lid follows the scroll position, written straight to the element so scrolling never re-renders React.
  React.useEffect(() => {
    const track = trackRef.current;
    const lid = lidRef.current;
    if (!track || !lid) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let open = false;
    const apply = () => {
      raf = 0;
      const r = track.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = reduce ? 1 : clamp01((vh * 0.45 - r.top) / (vh * 0.85));
      const eased = 1 - Math.pow(1 - p, 3);
      lid.style.transform = `rotateX(${(-(1 - eased) * CLOSED_DEG).toFixed(2)}deg)`;
      const isOpen = p >= 0.97;
      if (isOpen !== open) {
        open = isOpen;
        setInteractive(isOpen);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Only fetch while the section is on or near the screen.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "60% 0px 60% 0px" });
    io.observe(track);
    return () => io.disconnect();
  }, []);

  // The page inside is laid out at a fixed size and shrunk to fit the screen.
  React.useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / DEMO_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section ref={trackRef} id="live-monitoring" aria-label="Live customer monitoring, from the Waytara Office" className="relative h-[240vh] overflow-x-clip bg-theme-bg">
      <div className="sticky top-0 flex h-[100dvh] flex-col items-center justify-center px-3 pb-6 pt-20 sm:px-6">
        <div className="w-full max-w-[1120px]" style={{ perspective: "2600px", perspectiveOrigin: "50% 25%" }}>
          <div className="relative mx-auto w-full" style={{ transformStyle: "preserve-3d" }}>
            {/* the lid: its inside is the screen, its outside is the metal cover */}
            <div ref={lidRef} className="relative will-change-transform" style={{ transformOrigin: "50% 100%", transformStyle: "preserve-3d", transform: `rotateX(${-CLOSED_DEG}deg)` }}>
              <div className="relative rounded-t-[1.2rem] bg-[#0b0b0d] p-[1.6%] pb-[1.2%] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/60 sm:rounded-t-[1.6rem]" style={{ backfaceVisibility: "hidden" }}>
                <span aria-hidden="true" className="absolute left-1/2 top-[0.7%] size-[5px] -translate-x-1/2 rounded-full bg-zinc-700 sm:size-[6px]" />
                <div ref={screenRef} className="relative overflow-hidden rounded-[3px] bg-background sm:rounded-md" style={{ aspectRatio: `${DEMO_WIDTH} / ${DEMO_HEIGHT}` }}>
                  <div style={{ width: DEMO_WIDTH, height: DEMO_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }} className={interactive ? undefined : "pointer-events-none"}>
                    <DemoMonitoring data={data} />
                  </div>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />
                </div>
              </div>
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center rounded-t-[1.2rem] bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-400 sm:rounded-t-[1.6rem] dark:from-zinc-500 dark:via-zinc-600 dark:to-zinc-700"
                style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
              >
                <Image src="/images/icon.png" alt="" width={72} height={72} unoptimized className="size-[9%] max-w-[72px] object-contain opacity-70 grayscale" />
              </div>
            </div>

            {/* the base */}
            <div className="relative mx-auto -mt-px h-[11px] w-[108%] -translate-x-[3.7%] rounded-b-[1.4rem] bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-400 shadow-[0_18px_30px_-12px_rgba(0,0,0,0.45)] sm:h-[16px] dark:from-zinc-500 dark:via-zinc-600 dark:to-zinc-700">
              <span aria-hidden="true" className="absolute left-1/2 top-0 h-[55%] w-[16%] -translate-x-1/2 rounded-b-lg bg-zinc-400/70 dark:bg-zinc-800/60" />
            </div>
          </div>
        </div>

        <p className="mt-8 max-w-md text-center text-xs text-theme-secondary sm:text-sm">
          Live from our Waytara Office: the same Monitoring page our customers use. Try the tabs, or fold the sidebar.
        </p>
      </div>
    </section>
  );
}
