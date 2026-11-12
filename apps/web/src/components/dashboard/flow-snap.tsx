"use client";

import * as React from "react";

const HOST = '[data-slot="sidebar-inset"]';
const AWAY = "--flow-away";

/**
 * On a phone the Overview has two resting places: the energy flow (the top) and the cards under it. The page's scroll region snaps between them
 * (CSS scroll snap, so a flick or a drag on a phone glides the cards up to the top by itself, and pulling back glides the drawing back down), and
 * while it moves the drawing fades and lifts away, then fades back in as it returns (`--flow-away`, 0 = shown, 1 = away; read by the element marked
 * data-snap="flow"). The marks are `data-snap="flow"` and `data-snap="cards"`. A filler at the end gives the page enough length for the cards to reach the
 * top. Applies only under 640 px and only while this board is on the page; the scroll region is put back as it was when it leaves.
 */
export function FlowSnap({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const filler = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const host = ref.current;
    const fill = filler.current;
    const scroller = host?.closest<HTMLElement>(HOST)?.querySelector<HTMLElement>("main");
    const cards = host?.querySelector<HTMLElement>('[data-snap="cards"]');
    if (!host || !fill || !scroller || !cards) return;
    const phone = window.matchMedia("(max-width: 639px)");
    let frame = 0;
    let target = 1;
    const measure = () => {
      if (!phone.matches) return;
      const pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      // where the cards' top has to be for them to sit right under the header, and how long the page needs to be for that
      const top = cards.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - pad - 8;
      const have = fill.offsetHeight;
      const max = scroller.scrollHeight - scroller.clientHeight - have;
      fill.style.height = `${Math.max(0, Math.ceil(top - max))}px`;
      target = Math.max(1, top);
    };
    const update = () => {
      frame = 0;
      const away = phone.matches ? Math.min(1, Math.max(0, scroller.scrollTop / target)) : 0;
      host.style.setProperty(AWAY, away.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const apply = () => {
      if (phone.matches) {
        scroller.style.scrollSnapType = "y mandatory";
        scroller.style.scrollPaddingTop = `${(parseFloat(getComputedStyle(scroller).paddingTop) || 0) + 8}px`;
      } else {
        scroller.style.removeProperty("scroll-snap-type");
        scroller.style.removeProperty("scroll-padding-top");
        fill.style.height = "0px";
      }
      measure();
      update();
    };
    apply();
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    // (the wrapper itself has no box of its own)
    for (const c of Array.from(host.children)) ro.observe(c);
    ro.observe(scroller);
    phone.addEventListener("change", apply);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      phone.removeEventListener("change", apply);
      ro.disconnect();
      cancelAnimationFrame(frame);
      scroller.style.removeProperty("scroll-snap-type");
      scroller.style.removeProperty("scroll-padding-top");
    };
  }, []);
  return (
    <div ref={ref} className="contents">
      {children}
      <div ref={filler} aria-hidden="true" className="order-last sm:hidden" />
    </div>
  );
}
