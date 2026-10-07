"use client";

// React bindings for the telemetry store: one provider for the dashboard, and hooks for the screens.
// The store itself (store.ts) holds the data; screens only subscribe to the slices they show, so a live
// tick re-renders the few components that display it - never the page.

import * as React from "react";
import { createClient } from "@waytara/supabase/client";
import { idbKV, PersistentCache } from "./cache";
import { binStart, combineBuckets, dayAxis, istDayStart, toDisplay } from "./combine";
import { planRange, type RangePlan, type RangeWindow } from "./ranges";
import { loadLatest, loadOpen } from "./loaders";
import { DeviceLiveManager, type LiveEnv } from "./live-manager";
import { fetchSeries } from "./series";
import { TelemetryStore, type LatestValue, type LiveStatus, type SeriesRange } from "./store";
import type { DisplayPoint, TickPayload } from "./types";

type Sb = ReturnType<typeof createClient>;

interface Ctx {
  store: TelemetryStore;
  live: DeviceLiveManager;
}

const TelemetryContext = React.createContext<Ctx | null>(null);

function browserEnv(sb: Sb): LiveEnv {
  // The provider's state initializer also runs while the page is rendered on the server, where there is no
  // document/window: listening is then a no-op (nothing ever acquires a channel on the server).
  const listen = (target: Window | Document | undefined, events: string[], cb: () => void) => {
    if (!target) return () => {};
    events.forEach((e) => target.addEventListener(e, cb));
    return () => events.forEach((e) => target.removeEventListener(e, cb));
  };
  return {
    openChannel: async (deviceId, onTick, onStatus) => {
      await sb.realtime.setAuth(); // the signed-in session's token: the channel is private
      const channel = sb
        .channel(`device:${deviceId}`, { config: { private: true } })
        .on("broadcast", { event: "tick" }, (msg) => onTick(msg.payload as TickPayload))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") onStatus("joined");
          else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus("dropped");
        });
      return { close: () => void sb.removeChannel(channel) };
    },
    isVisible: () => typeof document !== "undefined" && document.visibilityState === "visible",
    isOnline: () => typeof navigator === "undefined" || navigator.onLine,
    onVisibility: (cb) => listen(typeof document === "undefined" ? undefined : document, ["visibilitychange"], cb),
    onPageHide: (cb) => listen(typeof window === "undefined" ? undefined : window, ["pagehide"], cb),
    onConnectivity: (cb) => listen(typeof window === "undefined" ? undefined : window, ["online", "offline"], cb),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

export function TelemetryProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [ctx] = React.useState<Ctx>(() => {
    const sb = createClient();
    const cache = new PersistentCache(idbKV(), userId);
    const store = new TelemetryStore({
      fetchSeries: (req) => fetchSeries(sb, req),
      loadLatest: (id) => loadLatest(sb, id),
      loadOpen: (id, keys) => loadOpen(sb, id, keys),
      cache,
    });
    const live = new DeviceLiveManager(browserEnv(sb), store, (e) => console.warn("[telemetry]", e));
    return { store, live };
  });

  React.useEffect(() => {
    const sb = createClient();
    const cache = new PersistentCache(idbKV(), userId);
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.access_token) void sb.realtime.setAuth(session.access_token);
      if (event === "SIGNED_OUT") {
        ctx.live.dispose(); // nothing may outlive the session, in memory or on disk
        ctx.store.reset();
        void cache.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, [ctx, userId]);

  React.useEffect(() => () => ctx.live.dispose(), [ctx]);

  return <TelemetryContext.Provider value={ctx}>{children}</TelemetryContext.Provider>;
}

function useCtx(): Ctx {
  const ctx = React.useContext(TelemetryContext);
  if (!ctx) throw new Error("telemetry hooks must be used inside <TelemetryProvider>");
  return ctx;
}

/** The shared store (for hooks built on top of it). */
export function useTelemetryStore(): TelemetryStore {
  return useCtx().store;
}

/** The newest value of one metric, live. Re-renders only when that value changes. */
export function useLatest(deviceId: string, key: string): LatestValue | undefined {
  const { store } = useCtx();
  return React.useSyncExternalStore(
    React.useCallback((cb) => store.subscribeKey(deviceId, key, cb), [store, deviceId, key]),
    () => store.getLatest(deviceId, key),
    () => undefined
  );
}

/** Keeps the device's live channel open while the calling component is mounted (ref-counted, tab-aware). */
export function useDeviceLive(deviceId: string): { status: LiveStatus; lastTickAt: number | null } {
  const { store, live } = useCtx();
  React.useEffect(() => live.acquire(deviceId), [live, deviceId]);
  return React.useSyncExternalStore(
    store.subscribe,
    () => store.getStatus(deviceId),
    () => store.getStatus(deviceId)
  );
}

export interface SeriesState {
  /** Bin start (epoch ms) of every slot of the day at the chosen interval. */
  axis: number[];
  /** Per metric, one entry per slot: the bucket, or null where the device reported nothing. */
  byKey: Record<string, (DisplayPoint | null)[]>;
  status: "loading" | "ready" | "error";
  /** Showing a copy from this browser's cache that is still being refreshed. */
  stale: boolean;
  error: string | null;
  retry: () => void;
  /** The current time, refreshed once a minute (screens must not read the clock while rendering). */
  nowMs: number;
}

/**
 * Today's buckets (IST day) for a set of metrics at 15 / 30 / 60 / 120 minutes. The database is asked once
 * for the 15-minute buckets of every metric the screen shows; the coarser views are combined locally, so
 * changing the interval costs no call. Live ticks update the open bucket in place.
 */
export function useTodaySeries(deviceId: string, keys: string[], minutes: number): SeriesState {
  const { store, live } = useCtx();
  const keysSig = keys.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableKeys = React.useMemo(() => keys, [keysSig]);

  const [dayStart, setDayStart] = React.useState(() => istDayStart(Date.now()));
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      setDayStart((prev) => (istDayStart(t) === prev ? prev : istDayStart(t)));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const range = React.useMemo<SeriesRange>(() => ({ fromMs: dayStart, toMs: dayStart + 86_400_000, minutes: 15 }), [dayStart]);

  const [attempt, setAttempt] = React.useState(0);
  const [failure, setFailure] = React.useState<{ id: string; message: string } | null>(null);
  const requestId = `${deviceId}|${keysSig}|${dayStart}|${attempt}`;

  React.useEffect(() => {
    let cancelled = false;
    const release = store.watch(deviceId, stableKeys);
    const releaseLive = live.acquire(deviceId);
    store
      .ensureSeries(deviceId, stableKeys, range, { force: attempt > 0 })
      .catch((e: unknown) => {
        if (!cancelled) setFailure({ id: requestId, message: e instanceof Error ? e.message : "Could not load this chart." });
      });
    return () => {
      cancelled = true;
      release();
      releaseLive();
    };
  }, [store, live, deviceId, stableKeys, range, attempt, requestId]);

  const rev = React.useSyncExternalStore(store.subscribe, () => store.getRev(deviceId), () => 0);

  const derived = React.useMemo(() => {
    void rev;
    const axis = dayAxis(dayStart, minutes);
    const byKey: Record<string, (DisplayPoint | null)[]> = {};
    let loaded = true;
    let stale = false;
    for (const key of stableKeys) {
      const base = store.getBuckets(deviceId, key, range);
      if (!base) {
        loaded = false;
        byKey[key] = axis.map(() => null);
        continue;
      }
      if (store.isStale(deviceId, key, range)) stale = true;
      const combined = minutes === 15 ? base : combineBuckets(base, minutes);
      const at = new Map(combined.map((b) => [binStart(b.t, minutes), toDisplay(b)]));
      byKey[key] = axis.map((t) => {
        const p = at.get(t);
        return p && p.covered > 0 ? p : null;
      });
    }
    return { axis, byKey, loaded, stale };
  }, [rev, store, deviceId, stableKeys, minutes, dayStart, range]);

  const error = failure && failure.id === requestId ? failure.message : null;
  return {
    axis: derived.axis,
    byKey: derived.byKey,
    status: derived.loaded ? "ready" : error ? "error" : "loading",
    stale: derived.stale,
    error,
    retry: React.useCallback(() => setAttempt((n) => n + 1), []),
    nowMs,
  };
}

export interface RangeSeriesState extends Omit<SeriesState, "retry"> {
  plan: RangePlan;
  /** The interval actually shown: the user's choice if the range allows it, else the plan's default. */
  minutes: number;
  retry: () => void;
}

/**
 * Buckets for any window (7 / 30 / 90 days, custom, or today) at the chosen interval. The database is asked once,
 * at the finest interval the window allows (`plan.base`); every coarser interval is combined locally, so changing
 * the interval costs no call. Results are cached in memory and in this browser (older, final windows for good).
 */
export function useSeriesRange(deviceId: string, keys: string[], w: RangeWindow, requestedMinutes: number | null): RangeSeriesState {
  const { store, live } = useCtx();
  const keysSig = keys.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableKeys = React.useMemo(() => keys, [keysSig]);

  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const plan = React.useMemo(() => planRange(w, nowMs), [w, nowMs]);
  const minutes = requestedMinutes !== null && plan.options.includes(requestedMinutes) ? requestedMinutes : plan.default;
  const range = React.useMemo<SeriesRange>(() => ({ fromMs: w.fromMs, toMs: w.toMs, minutes: plan.base }), [w, plan.base]);

  const [attempt, setAttempt] = React.useState(0);
  const [failure, setFailure] = React.useState<{ id: string; message: string } | null>(null);
  const requestId = `${deviceId}|${keysSig}|${range.fromMs}|${range.toMs}|${range.minutes}|${attempt}`;

  React.useEffect(() => {
    let cancelled = false;
    const release = store.watch(deviceId, stableKeys);
    const releaseLive = live.acquire(deviceId);
    store
      .ensureSeries(deviceId, stableKeys, range, { force: attempt > 0 })
      .catch((e: unknown) => {
        if (!cancelled) setFailure({ id: requestId, message: e instanceof Error ? e.message : "Could not load this chart." });
      });
    return () => {
      cancelled = true;
      release();
      releaseLive();
    };
  }, [store, live, deviceId, stableKeys, range, attempt, requestId]);

  const rev = React.useSyncExternalStore(store.subscribe, () => store.getRev(deviceId), () => 0);

  const derived = React.useMemo(() => {
    void rev;
    const size = minutes * 60_000;
    const first = binStart(w.fromMs, minutes);
    const axis: number[] = [];
    for (let t = first; t < w.toMs; t += size) axis.push(t);
    const byKey: Record<string, (DisplayPoint | null)[]> = {};
    let loaded = true;
    let stale = false;
    for (const key of stableKeys) {
      const base = store.getBuckets(deviceId, key, range);
      if (!base) {
        loaded = false;
        byKey[key] = axis.map(() => null);
        continue;
      }
      if (store.isStale(deviceId, key, range)) stale = true;
      const combined = minutes === plan.base ? base : combineBuckets(base, minutes);
      const at = new Map(combined.map((b) => [binStart(b.t, minutes), toDisplay(b)]));
      byKey[key] = axis.map((t) => {
        const p = at.get(t);
        return p && p.covered > 0 ? p : null;
      });
    }
    return { axis, byKey, loaded, stale };
  }, [rev, store, deviceId, stableKeys, minutes, w, range, plan.base]);

  const error = failure && failure.id === requestId ? failure.message : null;
  return {
    axis: derived.axis,
    byKey: derived.byKey,
    status: derived.loaded ? "ready" : error ? "error" : "loading",
    stale: derived.stale,
    error,
    retry: React.useCallback(() => setAttempt((n) => n + 1), []),
    nowMs,
    plan,
    minutes,
  };
}
