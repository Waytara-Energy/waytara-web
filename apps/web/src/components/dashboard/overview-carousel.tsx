"use client";

import * as React from "react";
import { EvCharger, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderSlot } from "./header-slot";
import { OverviewBackdrop } from "./overview-backdrop";

export interface OverviewSlide {
  id: string;
  /** The device's name, shown beside its icon while its slide is the one showing. */
  name: string;
  /** Which icon the device gets in the header (the same ones as its status buttons there). */
  kind: "inverter" | "charger";
  /** That device's Overview (the board). */
  content: React.ReactNode;
}

/**
 * The Overview as a row of slides, one per device: press a device's icon in the header (the one showing is lit and says its name), swipe,
 * press a dot or use the arrow keys to move between them. It opens on `initialIndex` (the device chosen in Application Settings). Plain CSS scroll-snap does the sliding, so a finger swipe
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
        {slides[0]?.content}
      </>
    );
  }

  return (
    <div className="relative">
      {background && <OverviewBackdrop css={background} />}

      <HeaderSlot>
        {/* One icon button per device: pressing it shows that device's Overview. The one showing is lit and carries the device's name. */}
        <div
          role="tablist"
          aria-label="Devices"
          className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const next = Math.min(count - 1, Math.max(0, index + (e.key === "ArrowRight" ? 1 : -1)));
            go(next);
            (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
          }}
        >
          {slides.map((s, i) => {
            const Icon = s.kind === "charger" ? EvCharger : Server;
            const active = i === index;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                title={s.name}
                aria-label={s.name}
                onClick={() => go(i)}
                className={cn(
                  "flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-emerald-600 dark:text-emerald-400")} />
                {active && <span className="hidden max-w-[12rem] truncate sm:block">{s.name}</span>}
              </button>
            );
          })}
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
        className="-mx-2 -my-2 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${s.name}`} aria-hidden={i !== index} className="w-full shrink-0 snap-center snap-always px-2 py-2">
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
