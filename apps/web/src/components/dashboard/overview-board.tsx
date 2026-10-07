"use client";

import type { ComponentProps, CSSProperties } from "react";
import type { EvCardsProps } from "./ev-live-status-cards";
import type { SolarCardsProps } from "./solar-live-status-cards";
import { EvLiveCards } from "./ev-live-cards";
import { LiveEnergyFlow } from "./overview-live";
import { EnergyTodayCards } from "./energy-today-cards";

/** Overview without scrolling: the energy flow large in the middle, sized to the screen's height, with the "today" cards
 *  on both sides - solar and grid on the left, load and battery on the right - each as tall as the screen allows. A site
 *  with an EV charger adds its charger cards under them. On a narrow screen the flow comes first and the cards follow
 *  in two columns at their natural height. */
export function OverviewBoard({ solar, ev, flow }: { solar: SolarCardsProps | null; ev: EvCardsProps | null; flow: ComponentProps<typeof LiveEnergyFlow> }) {
  // Two tall cards per side; with a charger, two shorter charger cards under them.
  const rows = ev ? "2fr 2fr 1fr 1fr" : "1fr 1fr";
  const side = "order-2 grid grid-cols-2 gap-3 lg:h-full lg:grid-cols-1 lg:[grid-template-rows:var(--rows)]";
  const style = { "--rows": rows } as CSSProperties;
  return (
    <div className="grid gap-4 lg:h-[max(calc(100svh-14rem),26rem)] lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2.4fr)_minmax(15rem,0.8fr)]">
      <div className={`${side} lg:order-1`} style={style}>
        {solar && <EnergyTodayCards {...solar} which="left" />}
        {ev && <EvLiveCards {...ev} which="left" />}
      </div>
      <div className="order-1 flex min-w-0 items-center lg:order-2">
        <div className="w-full">
          <LiveEnergyFlow {...flow} fit />
        </div>
      </div>
      <div className={`${side} lg:order-3`} style={style}>
        {solar && <EnergyTodayCards {...solar} which="right" />}
        {ev && <EvLiveCards {...ev} which="right" />}
      </div>
    </div>
  );
}
