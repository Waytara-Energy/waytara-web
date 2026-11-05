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
          <p className="text-xs text-theme-muted">{menu.bigLabel}</p>
          <ul className="mt-4 space-y-1.5">
            {menu.big.map((item) => (
              <li key={item.href}>
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
          <p className="text-xs text-theme-muted">{menu.asideTitle}</p>
          <ul className="mt-4 space-y-2.5">
            {menu.aside.map((item) => (
              <li key={item.href}>
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
 * The one panel under the header. It is always the same element: opening animates its height from nothing, closing animates back, and moving
 * from one header item to another only swaps what is inside (its height eases to the new content). Nothing fades out and back in, so there is
 * no flicker as the pointer travels along the bar. `menu` stays set while the panel closes so the content does not vanish mid-animation.
 */
export function MegaMenuShell({ menu, open, onNavigate }: { menu: HeaderMenu | null; open: boolean; onNavigate: () => void }) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [menu]);

  return (
    <div
      aria-hidden={!open}
      className={`absolute left-0 right-0 top-full hidden overflow-hidden bg-theme-bg text-theme-primary transition-[height] duration-300 ease-out motion-reduce:transition-none lg:block ${open ? "border-b border-theme-border shadow-xl" : "pointer-events-none"}`}
      style={{ height: open ? height : 0 }}
    >
      <div ref={innerRef}>{menu && <MegaMenuPanel key={menu.label} menu={menu} onNavigate={onNavigate} />}</div>
    </div>
  );
}
