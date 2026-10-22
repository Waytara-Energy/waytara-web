"use client";

import type { ComponentProps, CSSProperties } from "react";
import type { EvCardsProps } from "./ev-live-status-cards";
import type { SolarCardsProps } from "./solar-live-status-cards";
import { EvLiveCards } from "./ev-live-cards";
import { LiveEnergyFlow } from "./overview-live";
import { EnergyTodayCards } from "./energy-today-cards";
import { OverviewBackdrop } from "./overview-backdrop";
import { splitCards, type OverviewCardId } from "@/lib/overview-prefs";
import { cn } from "@/lib/utils";

/** Overview without scrolling: the energy flow in the middle, sized to the screen's height, with the person's four chosen "today" cards on
 *  both sides (two each; solar, grid, load and battery unless they chose others in Application Settings) - each as wide and tall as the
 *  screen allows, shrinking (their graph first) rather than pushing the page past the screen. A site with an EV charger adds its charger
 *  cards under them. On a narrow screen the flow comes first and the cards follow in two columns at their natural height. `background` is
 *  the CSS of the picture or gradient behind the whole page (null for none); the cards turn to frosted glass over it so the numbers stay
 *  readable. */
export function OverviewBoard({
  solar,
  ev,
  flow,
  cards,
  background,
}: {
  solar: SolarCardsProps | null;
  ev: EvCardsProps | null;
  flow: ComponentProps<typeof LiveEnergyFlow>;
  cards: OverviewCardId[];
  background: string | null;
}) {
  // Two tall cards per side; with a charger, two shorter charger cards under them.
  const rows = ev ? "2fr 2fr 1fr 1fr" : "1fr 1fr";
  const side = "order-2 grid min-h-0 grid-cols-2 gap-3 lg:h-full lg:grid-cols-1 lg:[grid-template-rows:var(--rows)]";
  const style = { "--rows": rows } as CSSProperties;
  const { left, right } = splitCards(cards);
  return (
    <div className={cn(background && "[&_[data-slot=card]]:border-white/15 [&_[data-slot=card]]:bg-card/60 [&_[data-slot=card]]:backdrop-blur-md [&_a.group]:border-white/15 [&_a.group]:bg-card/60 [&_a.group]:backdrop-blur-md")}>
      {background && <OverviewBackdrop css={background} />}
      <div className="grid gap-4 lg:h-[max(calc(100svh-9.5rem),30rem)] lg:grid-cols-[minmax(15rem,1fr)_minmax(0,42rem)_minmax(15rem,1fr)]">
        <div className={`${side} lg:order-1`} style={style}>
          {solar && <EnergyTodayCards {...solar} cards={left} />}
          {ev && <EvLiveCards {...ev} which="left" />}
        </div>
        {/* The whole middle is the drawing: as tall as the board allows, less its colour key. */}
        <div className="order-1 flex min-w-0 items-center justify-center lg:order-2" style={{ "--flow-h": "calc(max(100svh - 9.5rem, 30rem) - 3.5rem)" } as CSSProperties}>
          <div className="w-full">
            <LiveEnergyFlow {...flow} fit />
          </div>
        </div>
        <div className={`${side} lg:order-3`} style={style}>
          {solar && <EnergyTodayCards {...solar} cards={right} />}
          {ev && <EvLiveCards {...ev} which="right" />}
        </div>
      </div>
    </div>
  );
}
