"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { OverviewBackdrop } from "./overview-backdrop";
import { OverviewSky } from "./overview-sky";

export interface OverviewSlide {
  id: string;
  /** The device's name, shown under the board while its slide is the one showing (and as each dot's label). */
  name: string;
  /** That device's Overview (the board). */
  content: React.ReactNode;
  /** Whether this slide has the cloud sky behind it (the inverter's does; every other device has the plain theme background). */
  sky: boolean;
}

/**
 * The Overview as a row of slides, one per device: swipe, press a dot or use the arrow keys to move between them. Under the board, the dots
 * show which slide is showing, with the device's name above them. It opens on `initialIndex` (the device chosen in Application Settings). Plain CSS scroll-snap does the sliding, so a finger swipe
 * and a trackpad swipe feel native. The row is a little wider than the page's content and each slide has the same room inside, so the cards
 * line up exactly as they would without a carousel but their borders and shadows are never cut by the row's edge. With a single device there is no row and no controls: just that device's Overview.
 */
export function OverviewCarousel({ slides, initialIndex, background }: { slides: OverviewSlide[]; initialIndex: number; background: string | null }) {
  const count = slides.length;
  const start = Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0));
  const track = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef(0);
  const [index, setIndex] = React.useState(start);

  // The slide's exact distance from the left edge of the row, from where the browser put them: the row's width is often a fraction of a pixel
  // (browser zoom, a scrollbar), and a whole-pixel scroll position would leave the slide that much off and shave its edge.
  const offsetOf = (i: number): number => {
    const t = track.current;
    const slide = t?.children[i] as HTMLElement | undefined;
    if (!t || !slide) return 0;
    return t.scrollLeft + slide.getBoundingClientRect().left - t.getBoundingClientRect().left;
  };

  // Opening on a later slide: the row starts hidden (see its style) and is shown once it has been moved there, so the first slide never flashes.
  React.useLayoutEffect(() => {
    const t = track.current;
    if (!t) return;
    t.scrollLeft = offsetOf(start);
    t.style.visibility = "";
  }, [start]);

  // keep the same slide in view when the window changes size
  React.useEffect(() => {
    const t = track.current;
    if (!t) return;
    let width = t.getBoundingClientRect().width;
    const ro = new ResizeObserver(() => {
      const w = t.getBoundingClientRect().width;
      if (w === width) return;
      width = w;
      t.scrollLeft = offsetOf(index);
    });
    ro.observe(t);
    return () => ro.disconnect();
  }, [index]);

  // the slide nearest the middle of the row is the one being shown
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const t = track.current;
      if (!t) return;
      const box = t.getBoundingClientRect();
      const middle = box.left + box.width / 2;
      let best = 0;
      let distance = Infinity;
      for (let i = 0; i < count; i++) {
        const r = (t.children[i] as HTMLElement).getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - middle);
        if (d < distance) {
          distance = d;
          best = i;
        }
      }
      setIndex(best);
    });
  };

  const go = (to: number) => {
    const t = track.current;
    if (!t) return;
    t.scrollTo({ left: offsetOf(Math.min(count - 1, Math.max(0, to))), behavior: "smooth" });
  };

  if (count <= 1) {
    return (
      <>
        {background && <OverviewBackdrop css={background} />}
        {/* the cloud sky, on the inverter's slide only, unless the person chose a background of their own */}
        {!background && <OverviewSky active={slides[0]?.sky ?? false} />}
        {slides[0]?.content}
      </>
    );
  }

  return (
    <div className="relative">
      {background && <OverviewBackdrop css={background} />}
      {/* the cloud sky, on the inverter's slide only (it fades as the slide changes), unless the person chose a background of their own */}
      {!background && <OverviewSky active={slides[index]?.sky ?? false} />}

      <div
        ref={track}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Overview of each device"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(index - 1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            go(index + 1);
          }
        }}
        style={start === 0 ? undefined : { visibility: "hidden" }}
        className="-mx-2 -my-2 flex max-sm:-mx-6 snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${s.name}`} aria-hidden={i !== index} className="group/slide w-full shrink-0 snap-center snap-always px-2 py-2 max-sm:px-6">
            {s.content}
          </div>
        ))}
      </div>

      {/* Pinned to the foot of the window, in the middle (the sidebar overlays the page, so the window's middle is the page's middle), on the same
          line as the framework's dev badge at the left. Not shown on a phone (a swipe changes the device there). */}
      <div className="pointer-events-none fixed bottom-[1.1875rem] left-1/2 z-30 flex max-w-[90vw] -translate-x-1/2 flex-col items-center gap-1.5 rounded-full bg-background/70 px-4 py-1.5 backdrop-blur-sm max-sm:hidden">
        <span className="max-w-full truncate text-xs text-muted-foreground" aria-hidden="true">
          {slides[index]?.name}
        </span>
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${s.name}`}
              title={s.name}
              aria-current={i === index}
              className={cn("pointer-events-auto h-2 rounded-full transition-all", i === index ? "w-5 bg-foreground/70" : "w-2 bg-foreground/25 hover:bg-foreground/45")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
