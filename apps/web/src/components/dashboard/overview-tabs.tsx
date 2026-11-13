"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { EvCharger, LayoutGrid, Sun, type LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, useSwipeTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { OverviewBackdrop } from "./overview-backdrop";
import { OverviewSky } from "./overview-sky";

/** The id of the first tab: the site's own Overview (every device together). The other tabs carry their device's id. */
export const SITE_TAB = "site";

export interface OverviewTab {
  /** SITE_TAB for the site's Overview, else the device's id. */
  id: string;
  /** What the tab says: "Overview", or the device's name. */
  name: string;
  kind: "site" | "inverter" | "charger";
  /** That tab's page (a board). */
  content: React.ReactNode;
  /** Whether this tab has the cloud sky behind it (an inverter's does; the others have the plain theme background). */
  sky: boolean;
}

const ICON: Record<OverviewTab["kind"], LucideIcon> = { site: LayoutGrid, inverter: Sun, charger: EvCharger };

const TabsContext = React.createContext<{ open: (id: string) => void; has: (id: string) => boolean } | null>(null);
/** For what is inside a tab: open another tab (the site's Overview opens a device's tab when the device is pressed). Null outside the Overview's tabs. */
export const useOverviewTabs = () => React.useContext(TabsContext);

/** The tab's page. It comes in from the side the tab is on (the same movement as the other pages' tabs) by moving its left edge, not by a transform: a
 *  transform would make this box the frame of anything fixed to the screen inside it (the charger's Start / Stop bar on a phone). */
function Panel({ id, children }: { id: string; children: React.ReactNode }) {
  const { direction } = useSwipeTabs();
  return (
    <TabsPrimitive.Content
      value={id}
      className={cn("relative mt-3 outline-none max-sm:px-6", direction === "next" && "overview-tab-from-right", direction === "prev" && "overview-tab-from-left")}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

/**
 * The Overview as tabs: the site's own Overview first (every device together, as widgets), then one tab per device (an inverter's energy flow and
 * cards, a charger's page). Press a tab, use the arrow keys on the tab row, or swipe the page on a touch screen to move to the next one. Only the tab
 * being shown is drawn. It opens on `initialId` (the device asked for in the address or chosen in Application Settings, else the site's Overview)
 * and follows it when it changes (a device chosen from the sidebar while the Overview is open).
 */
export function OverviewTabs({ tabs, initialId, background }: { tabs: OverviewTab[]; initialId: string; background: string | null }) {
  const [value, setValue] = React.useState(initialId);
  // a new device asked for from outside (the address changed): go there (done while rendering, from what the prop was)
  const [seen, setSeen] = React.useState(initialId);
  if (seen !== initialId) {
    setSeen(initialId);
    setValue(initialId);
  }
  const current = tabs.find((t) => t.id === value) ?? tabs[0];
  const ids = tabs.map((t) => t.id).join("|");
  const context = React.useMemo(
    () => ({ open: (id: string) => setValue(id), has: (id: string) => ids.split("|").includes(id) }),
    [ids]
  );
  if (!current) return null;

  return (
    <TabsContext.Provider value={context}>
      <div className="relative">
        {background && <OverviewBackdrop css={background} />}
        {/* the cloud sky, on an inverter's tab only (it fades as the tab changes), unless the person chose a background of their own */}
        {!background && <OverviewSky active={current.sky} />}

        {/* On a phone the tabs' box reaches the screen's edges and the page keeps its own margin inside (an inverter's energy flow is a little wider than
            the page there, and only its empty margins may be cut). A sideways drag here is the page's own (the next tab), so the browser is told not to
            take it for one of its gestures (touch-action: up and down scrolling and pinch only). */}
        <Tabs value={current.id} onValueChange={setValue} className="[touch-action:pan-y_pinch-zoom] max-sm:-mx-6">
          <div className="flex justify-center max-sm:px-6">
            <TabsList aria-label="Overview pages" className="h-10 border-border bg-background/70 backdrop-blur-md sm:justify-start">
              {tabs.map((t) => {
                const Icon = ICON[t.kind];
                return (
                  <TabsTrigger key={t.id} value={t.id} className="gap-1.5 px-2.5 py-1.5 text-[13px] sm:px-3 text-muted-foreground data-[state=active]:text-white" title={t.name}>
                    <Icon className="size-3.5 shrink-0" />
                    <span className="max-w-28 truncate sm:max-w-40">{t.name}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <Panel key={current.id} id={current.id}>
            {current.content}
          </Panel>
        </Tabs>
      </div>
    </TabsContext.Provider>
  );
}
