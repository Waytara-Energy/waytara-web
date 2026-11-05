"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentMenuItem {
  id: string;
  label: string;
}

/**
 * The in-page menu of a long segment page. It sticks just under the site header, highlights the section being read, and scrolls
 * smoothly to a section when clicked. On a phone it scrolls sideways, and the highlighted item is kept in view.
 */
export function SegmentMenu({ items }: { items: SegmentMenuItem[] }) {
  const [active, setActive] = React.useState(items[0]?.id ?? "");
  const listRef = React.useRef<HTMLUListElement>(null);

  // The active section is the last one whose top has passed a line a little below the sticky bars.
  React.useEffect(() => {
    const update = () => {
      const line = window.innerHeight * 0.3;
      let current = items[0]?.id ?? "";
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  // Keep the active item visible in the sideways-scrolling list (phones). Scrolls the list only, never the page.
  React.useEffect(() => {
    const list = listRef.current;
    const button = list?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!list || !button) return;
    const target = button.offsetLeft - (list.clientWidth - button.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav
      aria-label="On this page"
      className="sticky top-[clamp(3.5rem,4.5vw,4.25rem)] z-30 border-y border-theme-border bg-theme-bg/90 backdrop-blur-md"
    >
      <div className="fluid-container">
        <ul ref={listRef} className="no-scrollbar flex gap-1 overflow-x-auto py-2">
          {items.map((item) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                data-id={item.id}
                aria-current={active === item.id ? "true" : undefined}
                onClick={() => go(item.id)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  active === item.id ? "bg-theme-surface text-theme-highlight" : "text-theme-secondary hover:text-theme-primary"
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
