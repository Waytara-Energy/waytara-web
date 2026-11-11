"use client";

import * as React from "react";
import Link from "next/link";
import type { HeaderMenu } from "@/config/site-nav";

/**
 * The full-width panel that drops from the header (the Apple pattern): a small label and a column of large links on the left, a small label and
 * a few small links on the right. The page behind it is dimmed and blurred by the header, not here.
 */
export function MegaMenuPanel({ menu, onNavigate }: { menu: HeaderMenu; onNavigate: () => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-10 sm:px-10">
      <div className="grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <p className="mega-item text-xs text-theme-muted">{menu.bigLabel}</p>
          <ul className="mt-4 space-y-1.5">
            {menu.big.map((item, i) => (
              <li key={item.href} className="mega-item" style={{ animationDelay: `${40 + i * 28}ms` }}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className="inline-block text-[clamp(1.35rem,2vw,1.75rem)] font-semibold leading-[1.25] tracking-tight text-theme-primary outline-none transition-colors hover:text-theme-highlight focus-visible:text-theme-highlight"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mega-item text-xs text-theme-muted" style={{ animationDelay: "40ms" }}>{menu.asideTitle}</p>
          <ul className="mt-4 space-y-2.5">
            {menu.aside.map((item, i) => (
              <li key={item.href} className="mega-item" style={{ animationDelay: `${80 + i * 28}ms` }}>
                <Link href={item.href} onClick={onNavigate} className="text-xs font-semibold text-theme-primary outline-none transition-colors hover:text-theme-highlight focus-visible:text-theme-highlight">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * The one panel under the header, timed like Apple's (measured frame by frame from a screen recording):
 *  - Opening: the panel fades in at its full height in about 0.2 s while the page behind it blurs, and its content fades up in a short stagger.
 *  - Closing: the whole panel fades out (it does not collapse), as the page comes back.
 *  - Moving to another item: the old content fades out as the new content fades in, and the panel eases to the new height.
 * It is always the same element, so nothing re-opens as the pointer travels along the bar. `menu` stays set while the panel closes, so its
 * content does not vanish mid-fade.
 */
/** What the shell shows: a key that changes when the content does, and how to draw it. */
export interface PanelSpec {
  key: string;
  render: (close: () => void) => React.ReactNode;
}

export function menuPanel(menu: HeaderMenu): PanelSpec {
  return { key: menu.label, render: (close) => <MegaMenuPanel menu={menu} onNavigate={close} /> };
}

export function MegaMenuShell({ menu, open, onNavigate }: { menu: PanelSpec | null; open: boolean; onNavigate: () => void }) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const previous = React.useRef<PanelSpec | null>(null);
  const [height, setHeight] = React.useState(0);
  // True once the panel has been open a moment: from then on a change of height is eased, but the first appearance is not (it fades, it does not grow).
  const [settled, setSettled] = React.useState(false);
  const [leaving, setLeaving] = React.useState<PanelSpec | null>(null);

  React.useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [menu]);

  React.useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), 240);
    return () => clearTimeout(t);
  }, [open]);

  // Moving from one item to another while open: keep the old content on screen for a moment, fading out under the new content.
  React.useEffect(() => {
    const before = previous.current;
    previous.current = menu;
    if (!open || !before || !menu || before.key === menu.key) return;
    setLeaving(before);
    const t = setTimeout(() => setLeaving(null), 180);
    return () => clearTimeout(t);
  }, [menu, open]);

  return (
    <div
      aria-hidden={!open}
      className="absolute left-0 right-0 top-full hidden overflow-y-auto overflow-x-hidden overscroll-contain border-b border-theme-border bg-theme-bg text-theme-primary shadow-xl motion-reduce:!transition-none lg:block"
      style={{
        height,
        // As tall as its content, but never more than 70 percent of the screen: only beyond that does the panel itself scroll.
        maxHeight: "70dvh",
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "auto" : "none",
        transition: `${settled && open ? "height 0.22s cubic-bezier(0.4, 0, 0.2, 1), " : ""}opacity 0.2s ease, visibility 0s linear ${open ? "0s" : "0.2s"}`,
      }}
    >
      <div ref={innerRef}>{menu && <React.Fragment key={menu.key}>{menu.render(onNavigate)}</React.Fragment>}</div>
      {leaving && (
        <div className="mega-leaving absolute inset-x-0 top-0" aria-hidden="true">
          <React.Fragment key={`leaving-${leaving.key}`}>{leaving.render(onNavigate)}</React.Fragment>
        </div>
      )}
    </div>
  );
}
