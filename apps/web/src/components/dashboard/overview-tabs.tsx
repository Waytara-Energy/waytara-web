"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { OverviewBackdrop } from "./overview-backdrop";
import { OverviewSky } from "./overview-sky";

/** The id of the first page: the site's own Overview (every device together). The other pages carry their device's id. */
export const SITE_TAB = "site";

export interface OverviewTab {
  /** SITE_TAB for the site's Overview, else the device's id. */
  id: string;
  /** Its name: "Overview", or the device's name (shown by the dots at the foot of a wide screen). */
  name: string;
  kind: "site" | "inverter" | "charger";
  /** That page (a board). */
  content: React.ReactNode;
  /** Whether this page has the cloud sky behind it (an inverter's does; the others have the plain theme background). */
  sky: boolean;
}

type Direction = "next" | "prev";

const TabsContext = React.createContext<{ open: (id: string) => void; has: (id: string) => boolean } | null>(null);
/** For what is inside a page: open another page (the site's Overview opens a device's page when the device is pressed). Null outside the Overview. */
export const useOverviewTabs = () => React.useContext(TabsContext);

// what a sideways drag must not start on: fields, sliders (the slide-to-confirm control marks itself) and maps. A drag that starts on one of the small
// graphs does change the page (as it did when the pages were a sliding row): a tap on a graph still shows its value.
const NO_SWIPE = 'input, textarea, select, [role="slider"], [data-no-swipe="true"], .no-swipe, .maplibregl-canvas, .maplibregl-map';
const TYPING = 'input, textarea, select, [contenteditable="true"], [role="slider"], [role="tab"], [role="menu"], [role="dialog"]';

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

/**
 * The Overview as pages you swipe between: the site's own Overview first (every device together, as widgets), then one page per device (an
 * inverter's energy flow and cards, a charger's page). There is no tab row: swipe left or right on a touch screen, swipe sideways with two fingers
 * on a trackpad, use the left and right arrow keys, or (on a wide screen) press a dot at the foot of the window. Only the page being shown is drawn.
 *
 * THE CHANGE OF PAGE is a view transition where the browser has them: the page that leaves slides away to its side, shrinking a little and blurring as
 * it fades, while the new one glides in from the other side (see globals.css). The browser animates pictures of the two pages, so nothing in the live
 * page is transformed and what is fixed to the screen inside a page (a charger's Start / Stop bar on a phone) stays where it is. Without view
 * transitions the new page comes in by its left edge; with reduced motion it simply changes.
 *
 * It opens on `initialId` (the device asked for in the address or chosen in Application Settings, else the site's Overview) and follows it when it
 * changes (a device chosen from the sidebar while the Overview is open).
 */
export function OverviewTabs({ tabs, initialId, background }: { tabs: OverviewTab[]; initialId: string; background: string | null }) {
  const [value, setValue] = React.useState(initialId);
  // the side the page comes in from when the browser has no view transitions (null = no movement)
  const [fallback, setFallback] = React.useState<Direction | null>(null);
  // a new device asked for from outside (the address changed): go there (done while rendering, from what the prop was)
  const [seen, setSeen] = React.useState(initialId);
  if (seen !== initialId) {
    setSeen(initialId);
    setValue(initialId);
    setFallback(null);
  }
  const found = tabs.findIndex((t) => t.id === value);
  const index = found >= 0 ? found : 0;
  const current = tabs[index];
  const ids = tabs.map((t) => t.id).join("|");

  const busy = React.useRef(false);
  const box = React.useRef<HTMLDivElement>(null);
  const go = React.useCallback(
    (to: number) => {
      const order = ids.split("|");
      if (to < 0 || to >= order.length || to === index || busy.current) return;
      const direction: Direction = to > index ? "next" : "prev";
      const doc = document as TransitionDocument;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!doc.startViewTransition || still) {
        setFallback(still ? null : direction);
        setValue(order[to]);
        return;
      }
      // the direction is on <html> for the length of the transition: the CSS names the page there and chooses the movement by it
      const root = document.documentElement;
      root.dataset.overviewDir = direction;
      // When the page has been scrolled, its top is under the dashboard's header: the pictures are cut there, so nothing shows over the header.
      const scroller = box.current?.closest("main");
      const hidden = scroller && box.current ? scroller.getBoundingClientRect().top + parseFloat(getComputedStyle(scroller).paddingTop) - box.current.getBoundingClientRect().top : 0;
      root.style.setProperty("--overview-clip-top", `${Math.max(0, Math.round(hidden))}px`);
      busy.current = true;
      // (a transition that never reports its end must not leave the pages stuck: it is closed after a second and a half at the latest)
      const guard = window.setTimeout(() => done(), 1500);
      const done = () => {
        window.clearTimeout(guard);
        delete root.dataset.overviewDir;
        root.style.removeProperty("--overview-clip-top");
        busy.current = false;
      };
      try {
        doc
          .startViewTransition(() =>
            flushSync(() => {
              setFallback(null);
              setValue(order[to]);
            })
          )
          .finished.then(done, done);
      } catch {
        done();
        setValue(order[to]);
      }
    },
    [ids, index]
  );

  const context = React.useMemo(
    () => ({
      open: (id: string) => go(ids.split("|").indexOf(id)),
      has: (id: string) => ids.split("|").includes(id),
    }),
    [ids, go]
  );

  // ---- a finger: a sideways swipe (a flick, or a longer drag) that is clearly not a scroll ----
  const touch = React.useRef({ x: 0, y: 0, lastX: 0, lastY: 0, at: 0, sideways: null as boolean | null, ignore: true });
  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (e.touches.length > 1 || !target || target.closest(NO_SWIPE)) {
      touch.current.ignore = true;
      return;
    }
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, lastX: t.clientX, lastY: t.clientY, at: e.timeStamp, sideways: null, ignore: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (s.ignore) return;
    const t = e.touches[0];
    s.lastX = t.clientX;
    s.lastY = t.clientY;
    if (s.sideways === null && Math.hypot(s.lastX - s.x, s.lastY - s.y) > 8) s.sideways = Math.abs(s.lastX - s.x) > Math.abs(s.lastY - s.y);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    if (s.ignore || s.sideways !== true) return;
    s.ignore = true;
    const dx = s.lastX - s.x;
    const dy = s.lastY - s.y;
    const speed = Math.abs(dx) / Math.max(1, e.timeStamp - s.at);
    const flick = Math.abs(dx) >= 28 && speed >= 0.22;
    if ((flick || Math.abs(dx) >= 42) && Math.abs(dx) > Math.abs(dy) * 1.25) go(dx < 0 ? index + 1 : index - 1);
  };

  // ---- a trackpad: two fingers sideways (one page per gesture: its momentum is let run out before the next) ----
  const wheel = React.useRef({ sum: 0, last: 0, lockedUntil: 0 });
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
    const w = wheel.current;
    if (e.timeStamp < w.lockedUntil) {
      w.lockedUntil = e.timeStamp + 250; // still the same gesture's momentum
      return;
    }
    if (e.timeStamp - w.last > 300) w.sum = 0;
    w.last = e.timeStamp;
    w.sum += e.deltaX;
    if (Math.abs(w.sum) < 70) return;
    go(w.sum > 0 ? index + 1 : index - 1);
    w.sum = 0;
    w.lockedUntil = e.timeStamp + 700;
  };

  // ---- the keyboard: left and right arrows, when nothing that uses them has the focus ----
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(TYPING)) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? index + 1 : index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  if (!current) return null;

  return (
    <TabsContext.Provider value={context}>
      <div className="relative">
        {background && <OverviewBackdrop css={background} />}
        {/* the cloud sky, on an inverter's page only (it fades as the page changes), unless the person chose a background of their own */}
        {!background && <OverviewSky active={current.sky} />}

        {/* On a phone this box reaches the screen's edges and the page keeps its own margin inside (an inverter's energy flow is a little wider than the
            page there, and only its empty margins may be cut). A sideways drag here is the page's own (the next page), so the browser is told not to take
            it for one of its gestures (touch-action: up and down scrolling and pinch only). */}
        <div
          ref={box}
          role="region"
          aria-roledescription="carousel"
          aria-label="Overview of the site and of each device"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => void (touch.current.ignore = true)}
          onWheel={onWheel}
          className="overflow-x-clip [touch-action:pan-y_pinch-zoom] max-sm:-mx-6"
        >
          <div
            key={current.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${tabs.length}: ${current.name}`}
            className={cn("overview-panel relative max-sm:px-6", fallback === "next" && "overview-tab-from-right", fallback === "prev" && "overview-tab-from-left")}
          >
            {current.content}
          </div>
        </div>

        {/* Which page is showing, and a way to change it without a swipe: pinned to the foot of the window, in the middle (the sidebar overlays the page, so
            the window's middle is the page's middle). Not shown on a phone (a swipe changes the page there). */}
        {tabs.length > 1 && (
          <div className="pointer-events-none fixed bottom-[1.1875rem] left-1/2 z-30 flex max-w-[90vw] -translate-x-1/2 flex-col items-center gap-1.5 rounded-full bg-background/70 px-4 py-1.5 backdrop-blur-sm max-sm:hidden">
            <span className="max-w-full truncate text-xs text-muted-foreground" aria-hidden="true">
              {current.name}
            </span>
            <div className="flex gap-1.5">
              {tabs.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${t.name}`}
                  title={t.name}
                  aria-current={i === index}
                  className={cn("pointer-events-auto h-2 rounded-full transition-all", i === index ? "w-5 bg-foreground/70" : "w-2 bg-foreground/25 hover:bg-foreground/45")}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </TabsContext.Provider>
  );
}
