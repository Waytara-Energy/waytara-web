"use client";

import * as React from "react";

/**
 * A countdown in whole seconds, for "Send again in 38s". `start(45)` begins it, and it stops at 0 by itself. It reads the clock rather than counting ticks, so a tab that
 * was in the background shows the right number when it comes back.
 */
export function useCountdown(): { left: number; start: (seconds: number) => void } {
  const [endsAt, setEndsAt] = React.useState(0);
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    if (endsAt === 0) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) window.clearInterval(id);
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const start = React.useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + seconds * 1000);
  }, []);

  return { left: endsAt === 0 ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000)), start };
}
