"use client";

import * as React from "react";

/**
 * How many rows of a list fit in the room it has, so a card shows only what fits (no scrolling) and leaves the rest to the detailed page.
 * Put `ref` on the list (a `<ul>`): on a wide screen it must be the part of the card that takes the room that is left (`flex-1 min-h-0 overflow-hidden`), and the
 * count is its height over the height of its first row (measured, so it follows the font size). Below the wide layout the card is as tall as its content, so a
 * fixed `fallback` number of rows is shown. At least one row is always shown.
 */
export function useFitRows(fallback: number) {
  const ref = React.useRef<HTMLUListElement>(null);
  const [count, setCount] = React.useState(fallback);
  React.useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      if (!wide.matches) {
        setCount(fallback);
        return;
      }
      const row = list.querySelector("li");
      if (!row) return;
      const rowH = row.getBoundingClientRect().height;
      if (rowH <= 0) return;
      setCount(Math.max(1, Math.floor((list.clientHeight + 1) / rowH)));
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(list);
    wide.addEventListener("change", measure);
    return () => {
      watcher.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, [fallback]);
  return { ref, count };
}
