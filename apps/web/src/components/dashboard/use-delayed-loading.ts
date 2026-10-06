"use client";

import * as React from "react";

/**
 * "Loading" that doesn't flash. A fast load never shows a skeleton at all (nothing is drawn for the first
 * `delayMs`, the space is just reserved), and once a skeleton has appeared it stays for at least `minMs` so
 * it doesn't blink away. Returns whether the skeleton may be visible right now, and whether the slot is still
 * inside the silent delay (reserve the space, draw nothing).
 */
export function useDelayedLoading(loading: boolean, delayMs = 150, minMs = 300): { showSkeleton: boolean; holding: boolean } {
  const [visible, setVisible] = React.useState(false);
  const shownAt = React.useRef(0);

  React.useEffect(() => {
    if (loading && !visible) {
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(t);
    }
    if (!loading && visible) {
      const t = setTimeout(() => setVisible(false), Math.max(0, minMs - (Date.now() - shownAt.current)));
      return () => clearTimeout(t);
    }
  }, [loading, visible, delayMs, minMs]);

  return { showSkeleton: visible, holding: loading && !visible };
}
