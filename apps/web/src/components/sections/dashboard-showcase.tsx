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

/** How much of the page is shown in the cropped view (design pixels): the header, the tabs, the live cards and the WHOLE first chart (with its time labels), then the fade.
 *  Measured: that chart ends at 600 to 670 design pixels on a wide screen and the fade is 100 to 125 design pixels tall, so 785 clears it everywhere. */
const CROP_HEIGHT = 785;
/** Below this width the page is drawn in its phone layout, at its own size, instead of as a shrunk desktop page. */
const PHONE_WIDTH = 720;
/** How tall the cropped phone layout is (CSS pixels): the first chart ends at about 658 px and the fade is about 92 px tall. */
const PHONE_CROP_HEIGHT = 765;

/**
 * The customer Monitoring page, exactly as the customer sees it, but only its first screen: it cannot be scrolled and it fades out at the bottom, so the rest
 * of the application is not on show. On a wide screen it is the desktop page, shrunk to the box; on a phone it is the phone layout at its own size. The tabs,
 * the charts, the menus, the weather, the notifications, the sites and Start / Stop charging (demo only) respond.
 */
export function CroppedDemo() {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const phone = width !== null && width < PHONE_WIDTH;
  const scale = width === null ? 0.7 : width / DEMO_WIDTH;
  const height = phone ? PHONE_CROP_HEIGHT : CROP_HEIGHT * scale;

  return (
    <div ref={boxRef} className="relative w-full overflow-clip rounded-3xl border border-theme-border bg-background" style={{ height }}>
      {width !== null &&
        (phone ? (
          <div style={{ width: "100%", height: PHONE_CROP_HEIGHT }}>
            <DemoMonitoring locked mobile />
          </div>
        ) : (
          <div style={{ width: DEMO_WIDTH, height: CROP_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <DemoMonitoring locked />
          </div>
        ))}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  );
}

/**
 * The customer Monitoring page (the same cropped container as on the Platform page, without a tablet around it), tipping up and growing as the visitor scrolls
 * (Aceternity's container scroll).
 */
export function DashboardShowcase() {
  return (
    <section id="live-monitoring" aria-label="The customer Monitoring page" className="relative z-0 flex flex-col overflow-hidden bg-theme-bg pt-24 md:pt-0">
      <ContainerScroll
        plain
        titleComponent={
          <>
            <h2 className="text-3xl font-semibold text-theme-primary md:text-5xl">
              Every device, every site <br />
              <span className="text-primary-gradient mt-1 text-4xl font-bold leading-none md:text-[5rem]">in one dashboard.</span>
            </h2>
          </>
        }
      >
        <CroppedDemo />
      </ContainerScroll>
      <div className="pb-24 pt-8 md:pt-8">
        <DashboardKeyFeatures />
      </div>
    </section>
  );
}
