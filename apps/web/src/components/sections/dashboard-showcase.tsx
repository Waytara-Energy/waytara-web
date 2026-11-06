"use client";

import * as React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { DashboardKeyFeatures } from "./dashboard-key-features";
import { DemoMonitoring, DEMO_HEIGHT, DEMO_WIDTH } from "./demo-monitoring";

/** The page may stretch a little taller than its design height to use a tall card, but no more (it scrolls inside). */
const MAX_STRETCH = 1.15;

/** The Monitoring page, laid out at its design size and shrunk to fill whatever box it is given. The box clips (not hides) its overflow:
 *  a hidden box can still be scrolled sideways by focus or a click, which would slide the scaled page out of place. */
export function FittedDemo() {
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
    <div ref={boxRef} className="relative h-full w-full overflow-clip rounded-xl bg-background">
      <div style={{ width: fit.width, height: fit.height, transform: `translateY(${fit.top}px) scale(${fit.scale})`, transformOrigin: "top left" }}>
        <DemoMonitoring />
      </div>
    </div>
  );
}

/** How much of the page is shown in the cropped view (design pixels): the header, the tabs, the live cards and the top of the first chart. */
const CROP_HEIGHT = 640;

/**
 * The customer Monitoring page, exactly as the customer sees it, but only its first screen: it fits the box by width, cannot be scrolled, and fades out at
 * the bottom, so the rest of the application is not on show. The tabs, the interval, the charts and the device menu (an inverter and an EV charger) respond.
 */
export function CroppedDemo() {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.7);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const width = e.contentRect.width;
      if (width) setScale(width / DEMO_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative w-full overflow-clip rounded-3xl border border-theme-border bg-background" style={{ height: CROP_HEIGHT * scale }}>
      <div style={{ width: DEMO_WIDTH, height: CROP_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <DemoMonitoring locked />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  );
}

/**
 * The customer Monitoring page on sample figures, on a card that tips up and grows as the visitor scrolls (Aceternity's container
 * scroll). The tabs, the interval, the charts and the device menu respond; the sidebar and the notifications do not open.
 */
export function DashboardShowcase() {
  return (
    <section id="live-monitoring" aria-label="The customer Monitoring page, with sample data" className="relative z-0 -mt-24 flex flex-col overflow-hidden bg-theme-bg md:-mt-52">
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
        <FittedDemo />
      </ContainerScroll>
      <div className="-mt-20 pb-24 md:-mt-36">
        <DashboardKeyFeatures />
      </div>
    </section>
  );
}
