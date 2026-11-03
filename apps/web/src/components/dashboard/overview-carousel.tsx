"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeaderSlot } from "./header-slot";
import { OverviewBackdrop } from "./overview-backdrop";

export interface OverviewSlide {
  id: string;
  /** The device's name, shown in the header. */
  name: string;
  /** That device's Overview (the board). */
  content: React.ReactNode;
}

/**
 * The Overview as a row of slides, one per device: swipe, use the arrows in the header, press a dot or use the arrow keys to move between
 * them. It opens on `initialIndex` (the device chosen in Application Settings). Plain CSS scroll-snap does the sliding, so a finger swipe
 * and a trackpad swipe feel native. With a single device there is no row and no controls: just that device's Overview.
 */
export function OverviewCarousel({ slides, initialIndex, background }: { slides: OverviewSlide[]; initialIndex: number; background: string | null }) {
  const count = slides.length;
  const start = Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0));
  const track = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef(0);
  const [index, setIndex] = React.useState(start);

  // Opening on a later slide: the row starts hidden (see its style) and is shown once it has been moved there, so the first slide never flashes.
  React.useLayoutEffect(() => {
    const t = track.current;
    if (!t) return;
    t.scrollLeft = start * t.clientWidth;
    t.style.visibility = "";
  }, [start]);

  // keep the same slide in view when the window changes size
  React.useEffect(() => {
    const t = track.current;
    if (!t) return;
    let width = t.clientWidth;
    const ro = new ResizeObserver(() => {
      if (t.clientWidth === width) return;
      width = t.clientWidth;
      t.scrollLeft = index * width;
    });
    ro.observe(t);
    return () => ro.disconnect();
  }, [index]);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const t = track.current;
      if (!t || t.clientWidth === 0) return;
      setIndex(Math.min(count - 1, Math.max(0, Math.round(t.scrollLeft / t.clientWidth))));
    });
  };

  const go = (to: number) => {
    const t = track.current;
    if (!t) return;
    const i = Math.min(count - 1, Math.max(0, to));
    t.scrollTo({ left: i * t.clientWidth, behavior: "smooth" });
  };

  if (count <= 1) {
    return (
      <>
        {background && <OverviewBackdrop css={background} />}
        {slides[0]?.content}
      </>
    );
  }

  return (
    <div className="relative">
      {background && <OverviewBackdrop css={background} />}

      <HeaderSlot>
        <div className="flex items-center gap-1" role="group" aria-label="Choose a device">
          <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous device">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="hidden max-w-[11rem] truncate px-1 text-sm font-medium text-foreground sm:block">{slides[index]?.name}</span>
          <span className="px-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {index + 1} / {count}
          </span>
          <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === count - 1} onClick={() => go(index + 1)} aria-label="Next device">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </HeaderSlot>

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
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${s.name}`} aria-hidden={i !== index} className="w-full shrink-0 snap-center snap-always">
            {s.content}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-1.5 pb-0.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show ${s.name}`}
            aria-current={i === index}
            className={cn("pointer-events-auto h-2 rounded-full transition-all", i === index ? "w-5 bg-foreground/70" : "w-2 bg-foreground/25 hover:bg-foreground/45")}
          />
        ))}
      </div>
    </div>
  );
}
