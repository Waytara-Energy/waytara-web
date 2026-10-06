"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";
import { istDate } from "@/lib/telemetry/combine";
import { windowFor, type RangePreset, type RangeWindow } from "@/lib/telemetry/ranges";

interface RangeState {
  preset: RangePreset;
  /** First day of a custom window (YYYY-MM-DD, IST). */
  customStart: string | null;
}

interface RangeContextValue extends RangeState {
  window: RangeWindow;
  setPreset: (p: RangePreset) => void;
  setCustomStart: (day: string) => void;
  /** The device's first day with data (YYYY-MM-DD), once known - the earliest a custom window may start. */
  firstDay: string | null;
  /** Today's date in IST. */
  today: string;
}

const RangeContext = React.createContext<RangeContextValue | null>(null);

const storageKey = (deviceId: string) => `waytara:range:${deviceId}`;

/** The range (Today / 7 / 30 / 90 days / custom) a page's charts follow. Chosen per device and remembered for this
 *  browser tab (sessionStorage), never sent anywhere. Pages that mount a RangeBar wrap their content in this. */
export function RangeProvider({ deviceId, children }: { deviceId: string; children: React.ReactNode }) {
  const [state, setState] = React.useState<RangeState>({ preset: "today", customStart: null });
  const [firstDay, setFirstDay] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  // Restore the tab's last choice after mount (the server render always starts at "today").
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(deviceId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(JSON.parse(raw) as RangeState);
    } catch {
      /* storage unavailable: start at today */
    }
  }, [deviceId]);

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
        sessionStorage.setItem(storageKey(deviceId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [deviceId]
  );

  const value = React.useMemo<RangeContextValue>(() => {
    const today = istDate(now);
    return {
      ...state,
      window: windowFor(state.preset, now, state.customStart),
      setPreset: (preset) => persist({ ...state, preset }),
      setCustomStart: (day) => persist({ preset: "custom", customStart: day }),
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
