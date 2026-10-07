"use client";

import * as React from "react";
import { Cell } from "recharts";

/** Highlights only the hovered column of a bar chart: while the pointer is over one, every other column dims. Spread
 *  `chartProps` on the chart and give each `<Bar>` `cells(count, fill)` as its children. */
export function useBarHover() {
  const [index, setIndex] = React.useState<number | null>(null);
  const chartProps = {
    onMouseMove: (state: { activeTooltipIndex?: unknown }) => {
      const i = Number(state.activeTooltipIndex);
      setIndex(state.activeTooltipIndex === undefined || state.activeTooltipIndex === null || Number.isNaN(i) ? null : i);
    },
    onMouseLeave: () => setIndex(null),
  };
  /** One `<Cell>` per column; `fill` is one colour or a colour for each column. `hasBar(i)` says whether column i has a
   *  bar at all - hovering an empty column highlights nothing, so the others stay as they are. */
  const cells = (count: number, fill: string | ((i: number) => string), hasBar?: (i: number) => boolean) => {
    const active = index !== null && (hasBar ? hasBar(index) : true) ? index : null;
    return Array.from({ length: count }, (_, i) => (
      <Cell key={i} fill={typeof fill === "string" ? fill : fill(i)} fillOpacity={active !== null && active !== i ? 0.3 : 1} />
    ));
  };
  return { chartProps, cells };
}
