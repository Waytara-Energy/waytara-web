"use client";

import { useEffect, useState } from "react";
import { Sun, BatteryCharging, Home, Zap, Server, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs } from "@/components/ui/tabs";

export interface TabHeadlineInfo {
  /** The tab's one live number, e.g. "16.0 kWh". */
  value: string;
  /** What that number actually is, e.g. "Power Generated". Shown as this
   *  headline's own small label — the tab's *name* isn't repeated here at
   *  all, since the selected tab button right below already says it. */
  label: string;
}

// Icon + accent color per node, kept here (not passed down as a prop) —
// a LucideIcon component reference can't cross the server/client boundary
// as a prop, and this client component can just import the handful of
// icons it needs directly. Keyed by the same tab `value` strings
// MonitoringContent already uses ("hub", "solar", ...).
const TAB_VISUALS: Record<string, { icon: LucideIcon; iconClassName: string }> = {
  hub: { icon: Server, iconClassName: "bg-primary/15 text-primary" },
  solar: { icon: Sun, iconClassName: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  battery: { icon: BatteryCharging, iconClassName: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  load: { icon: Home, iconClassName: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  grid: { icon: Zap, iconClassName: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
};

/** The selected tab's own headline, above the tab strip — icon, what the
 *  number below it actually is, and the number itself. Deliberately
 *  doesn't repeat the tab's own *name* — the selected tab button right
 *  below already says that, so this slot holds the one thing that isn't
 *  shown anywhere else instead. Reads `headlines`/`TAB_VISUALS` by the
 *  current `value` so it's this component's own Radix-driven tab state
 *  deciding which one shows, no group-data/CSS trick needed. */
function TabHeadlineBar({ tabValue, headline, actions }: { tabValue: string; headline: TabHeadlineInfo; actions?: React.ReactNode }) {
  const visual = TAB_VISUALS[tabValue] ?? TAB_VISUALS.hub;
  const Icon = visual.icon;
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", visual.iconClassName)}>
          <Icon className="size-7" />
        </span>
        <div>
          <p className="text-sm font-medium text-theme-muted">{headline.label}</p>
          <p className="text-4xl font-semibold leading-tight tracking-tight text-theme-primary">{headline.value}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}

/** Wraps the Tabs primitive with two things an uncontrolled `<Tabs
 *  defaultValue>` can't do on its own:
 *  1. Honoring an incoming #hash (e.g. an Overview card's deep-link into a
 *     specific node) as the starting tab. The server has no access to
 *     location.hash, so this renders `defaultValue` for SSR/first paint
 *     and switches right after mount if a hash is present, rather than
 *     guessing it server-side. Keeps the hash in sync on every tab change
 *     too, so a reload or a copied link lands back on the same tab
 *     instead of resetting to the first one.
 *  2. Showing the selected tab's own headline above the tab strip itself
 *     — `headlines` carries every tab's live number, keyed by its value,
 *     and this component's own tracked `value` picks which one to render;
 *     the caller doesn't need any client state of its own for it. */
export function MonitoringTabs({
  defaultValue,
  headlines,
  actions,
  children,
}: {
  defaultValue: string;
  headlines: Record<string, TabHeadlineInfo>;
  /** Shown at the right of the headline, in line with its number (the period picker). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    // Deliberately deferred to an effect, not read during the initial
    // render (e.g. via useState's lazy initializer) — location.hash isn't
    // available server-side, so reading it during render would mismatch
    // the SSR-rendered `defaultValue` and trigger a hydration error. This
    // is exactly the "sync with a browser API unavailable during SSR"
    // case an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hash) setValue(hash);
  }, []);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        setValue(next);
        history.replaceState(null, "", `#${next}`);
      }}
    >
      {headlines[value] && <TabHeadlineBar tabValue={value} headline={headlines[value]} actions={actions} />}
      {children}
    </Tabs>
  );
}
