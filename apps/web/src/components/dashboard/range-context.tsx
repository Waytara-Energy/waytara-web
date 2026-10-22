"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";
import { istDate } from "@/lib/telemetry/combine";
import { windowFor, type RangePreset, type RangeWindow } from "@/lib/telemetry/ranges";

interface RangeState {
  preset: RangePreset;
  /** First day of a custom window (YYYY-MM-DD, IST). */
  customStart: string | null;
  /** Last day of a custom window; missing in a choice saved before windows had an end (it then runs 30 days from the start). */
  customEnd?: string | null;
}

interface RangeContextValue extends RangeState {
  window: RangeWindow;
  setPreset: (p: RangePreset) => void;
  /** A custom window from its first day to its last (the same day for a single day; at most 90 days). */
  setCustomRange: (start: string, end: string) => void;
  /** The device's first day with data (YYYY-MM-DD), once known - the earliest a custom window may start. */
  firstDay: string | null;
  /** Today's date in IST. */
  today: string;
}

const RangeContext = React.createContext<RangeContextValue | null>(null);

const storageKey = (deviceId: string, scope?: string) => `waytara:range:${scope ? `${scope}:` : ""}${deviceId}`;

/** The range (Today / 7 / 30 / 90 days / custom) a page's charts follow. Chosen per device and remembered for this
 *  browser tab (sessionStorage), never sent anywhere. Pages that mount a RangeBar wrap their content in this. */
export function RangeProvider({ deviceId, scope, defaultPreset = "today", children }: { deviceId: string; /** Keeps this page's choice apart from another page's (Monitoring and Performance each remember their own). */ scope?: string; /** What a page starts on before a choice is remembered (Today unless the page says otherwise). */ defaultPreset?: RangePreset; children: React.ReactNode }) {
  const [state, setState] = React.useState<RangeState>({ preset: defaultPreset, customStart: null, customEnd: null });
  const [firstDay, setFirstDay] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  // Restore the tab's last choice after mount (the server render always starts at "today").
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(deviceId, scope));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(JSON.parse(raw) as RangeState);
    } catch {
      /* storage unavailable: start at today */
    }
  }, [deviceId, scope]);

  React.useEffect(() => {
    let cancelled = false;
    void createClient()
      .rpc("device_data_range", { p_equipment_id: deviceId })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled && row?.first_day) setFirstDay(row.first_day as string);
      });
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [deviceId]);

  const persist = React.useCallback(
    (next: RangeState) => {
      setState(next);
      try {
        sessionStorage.setItem(storageKey(deviceId, scope), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [deviceId, scope]
  );

  const value = React.useMemo<RangeContextValue>(() => {
    const today = istDate(now);
    return {
      ...state,
      window: windowFor(state.preset, now, state.customStart, state.customEnd),
      setPreset: (preset) => persist({ ...state, preset }),
      setCustomRange: (start, end) => persist({ preset: "custom", customStart: start, customEnd: end }),
      firstDay,
      today,
    };
  }, [state, now, firstDay, persist]);

  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>;
}

/** The current range, or null on a page without a RangeProvider (charts then stay on "today"). */
export function useRange(): RangeContextValue | null {
  return React.useContext(RangeContext);
}
