"use client";

import * as React from "react";
import { chartStyleCookie, type ChartStyle } from "@/lib/chart-style";

const ChartStyleContext = React.createContext<{ style: ChartStyle; setStyle: (s: ChartStyle) => void }>({ style: "auto", setStyle: () => {} });

/** The person's chart style (from their cookie, read by the layout), shared by every chart under it. Changing it redraws them at once
 *  and remembers the choice. */
export function ChartStyleProvider({ initial, children }: { initial: ChartStyle; children: React.ReactNode }) {
  const [style, setStyleState] = React.useState<ChartStyle>(initial);
  const setStyle = React.useCallback((next: ChartStyle) => {
    setStyleState(next);
    document.cookie = chartStyleCookie(next);
  }, []);
  const value = React.useMemo(() => ({ style, setStyle }), [style, setStyle]);
  return <ChartStyleContext.Provider value={value}>{children}</ChartStyleContext.Provider>;
}

export const useChartStyle = (): ChartStyle => React.useContext(ChartStyleContext).style;
export const useSetChartStyle = () => React.useContext(ChartStyleContext).setStyle;
