"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const STALE_AFTER_MINUTES = 30;
// Recomputed on this cadence rather than every second — a literal
// per-second ticking clock is distracting and re-renders constantly for no
// real benefit at this granularity; most "live" apps (Slack, GitHub, X)
// refresh a relative timestamp every so often, not every tick of the
// second hand, since "just now" / "2m ago" doesn't need second-level
// precision to stay honest.
const REFRESH_MS = 30_000;

function formatAgo(ms: number): { text: string; minutesAgo: number } {
  const minutesAgo = ms / 60000;
  if (minutesAgo < 0.5) return { text: "just now", minutesAgo };
  if (minutesAgo < 60) return { text: `${Math.round(minutesAgo)}m ago`, minutesAgo };
  const hours = Math.floor(minutesAgo / 60);
  return { text: `${hours}h ${Math.round(minutesAgo % 60)}m ago`, minutesAgo };
}

/** A live "updated X ago" readout — ticks on its own client-side clock
 *  rather than the server-computed snapshot `LastSyncIndicator` uses
 *  elsewhere (which only updates whenever a new reading triggers this
 *  page's RealtimeRefresh), since sitting in the header this is looked at
 *  continuously, not just once on load. Refreshes every REFRESH_MS instead
 *  of every second (see its own comment). Renders a stable placeholder
 *  until the first client tick to avoid a hydration mismatch — the exact
 *  "ago" text is inherently a client-only value, the same reasoning any
 *  ticking-clock component needs.
 *
 *  Clicking swaps the relative text for the exact clock time (and back) —
 *  the relative text is the quick-glance signal, the exact time is there
 *  for whoever actually needs to know precisely when. */
export function LiveSyncedAgo({ lastTs }: { lastTs: string | null }) {
  const [state, setState] = useState<{ text: string; isStale: boolean } | null>(null);
  const [showExact, setShowExact] = useState(false);

  useEffect(() => {
    if (!lastTs) {
      setState(null);
      return;
    }
    const tick = () => {
      const { text, minutesAgo } = formatAgo(Date.now() - new Date(lastTs).getTime());
      setState({ text, isStale: minutesAgo > STALE_AFTER_MINUTES });
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => clearInterval(id);
  }, [lastTs]);

  if (!lastTs) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-theme-muted">
        <RefreshCw className="size-3.5" />
        No data yet
      </span>
    );
  }

  const exactTime = new Date(lastTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

  return (
    <button
      type="button"
      onClick={() => setShowExact((v) => !v)}
      title={showExact ? "Show relative time" : "Show exact time"}
      className={cn(
        "flex items-center gap-1.5 text-xs transition-colors",
        state?.isStale ? "text-amber-600 dark:text-amber-400" : "text-theme-muted hover:text-theme-primary"
      )}
    >
      <RefreshCw className="size-3.5" />
      {!state ? "Syncing…" : showExact ? `Updated at ${exactTime}` : `Updated ${state.text}`}
    </button>
  );
}
