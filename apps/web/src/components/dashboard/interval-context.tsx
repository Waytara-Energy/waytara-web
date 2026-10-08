"use client";

import * as React from "react";
import { DEFAULT_INTERVAL_MINUTES } from "@/lib/day-buckets";

type Shared = [number, (minutes: number) => void];
const IntervalContext = React.createContext<Shared | null>(null);

/** One interval (15 min / 30 min / 1 hour / 2 hours) for every chart under it: picking it on any chart changes them all, and it
 *  stays while you move between tabs. */
export function IntervalProvider({ children }: { children: React.ReactNode }) {
  const state = React.useState<number>(DEFAULT_INTERVAL_MINUTES);
  const value = React.useMemo<Shared>(() => [state[0], state[1]], [state]);
  return <IntervalContext.Provider value={value}>{children}</IntervalContext.Provider>;
}

/** The interval shared by the page's charts (a local one where there is no provider above). */
export function useSharedInterval(): Shared {
  const local = React.useState<number>(DEFAULT_INTERVAL_MINUTES);
  return React.useContext(IntervalContext) ?? local;
}
