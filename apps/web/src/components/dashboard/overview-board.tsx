"use client";

import {
  Fragment,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { SolarCardsProps } from "./solar-live-status-cards";
import { LiveEnergyFlow } from "./overview-live";
import { EnergyTodayCards } from "./energy-today-cards";
import { OverviewBackdrop } from "./overview-backdrop";
import { FlowSnap } from "./flow-snap";
import { splitCards, type OverviewCardId } from "@/lib/overview-prefs";
import { cn } from "@/lib/utils";

/** Overview without scrolling: the energy flow in the middle, sized to the screen's height, with the person's four chosen "today" cards on
 *  both sides (two each; solar, grid, load and battery unless they chose others in Application Settings) - each as wide and tall as the
 *  screen allows, shrinking (their graph first) rather than pushing the page past the screen. On a narrow screen the flow comes first and the cards follow in two columns at their natural height. `background` is
 *  the CSS of the picture or gradient behind the whole page (null for none); the cards turn to frosted glass over it so the numbers stay
 *  readable. */
export function OverviewBoard({
  solar,
  flow,
  center,
  cards,
  background,
  backdrop = true,
}: {
  /** The four "today" cards of an inverter's Overview. */
  solar: SolarCardsProps | null;
  /** The energy flow of an inverter's Overview. */
  flow?: ComponentProps<typeof LiveEnergyFlow>;
  /** What fills the middle instead of the energy flow. */
  center?: ReactNode;
  cards: OverviewCardId[];
  background: string | null;
  /** Paint the background layer here. A carousel of boards paints it once itself and turns this off (the cards still turn to glass). */
  backdrop?: boolean;
}) {
  // Two tall cards per side.
  const rows = "1fr 1fr";
  const side =
    "order-2 grid min-h-0 grid-cols-2 gap-3 lg:h-full lg:grid-cols-1 lg:[grid-template-rows:var(--rows)]";
  const style = { "--rows": rows } as CSSProperties;
  const { left, right } = splitCards(cards);
  // the inverter's board (with the energy flow) snaps between the drawing and the cards on a phone
  const Snap = flow ? FlowSnap : Fragment;
  return (
    <div
      className={cn(
        background &&
          "[&_[data-slot=card]]:border-white/15 [&_[data-slot=card]]:bg-card/60 [&_[data-slot=card]]:backdrop-blur-md [&_a.group]:border-white/15 [&_a.group]:bg-card/60 [&_a.group]:backdrop-blur-md",
      )}
    >
      {background && backdrop && <OverviewBackdrop css={background} />}
      <Snap>
        <div className="grid gap-4 lg:h-[max(calc(100svh-9.5rem),30rem)] lg:grid-cols-[minmax(15rem,1fr)_minmax(0,42rem)_minmax(15rem,1fr)]">
          <div
            className={cn(side, "lg:order-1", flow && "max-sm:snap-start")}
            style={style}
            data-snap={flow ? "cards" : undefined}
          >
            {solar && <EnergyTodayCards {...solar} cards={left} />}
          </div>
          {/* The whole middle is the drawing: as tall as the board allows, less its colour key. */}
          <div
            className="order-1 flex min-w-0 flex-col items-center justify-center gap-3 lg:order-2"
            style={
              {
                "--flow-h": "calc(max(100svh - 9.5rem, 30rem) - 3.5rem)",
              } as CSSProperties
            }
          >
            {center ? (
              <div className="w-full">{center}</div>
            ) : flow ? (
              // on a phone it fades and lifts away as the page snaps down to the cards, and comes back the same way
              <div data-snap="flow" className="w-full max-sm:snap-start">
                <div className="max-sm:[opacity:calc(1-var(--flow-away,0)*0.85)] max-sm:[translate:0_calc(var(--flow-away,0)*-1.25rem)]">
                  <LiveEnergyFlow {...flow} fit />
                </div>
              </div>
            ) : null}
          </div>
          <div className={`${side} lg:order-3`} style={style}>
            {solar && <EnergyTodayCards {...solar} cards={right} />}
          </div>
        </div>
      </Snap>
    </div>
  );
}
