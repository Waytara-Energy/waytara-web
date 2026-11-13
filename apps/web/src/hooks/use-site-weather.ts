"use client";

import * as React from "react";
import type { HourPoint, Weather } from "@/lib/weather";

/**
 * The weather at the selected site, kept in this browser so the weather service is asked only ONCE A DAY. The first time a site's weather is wanted on an
 * India date, /api/weather is asked for the day's forecast (the conditions now, the sun, the sunshine hour by hour, and the next 48 hours one by one) and
 * the answer is stored (localStorage, one entry per site). Everything after that, on this page, in the header and on later visits the same day, reads the
 * stored forecast: "now" is worked out from the forecast hour that is current, and it is worked out again at the top of every hour (and when the page is
 * looked at again after a while), with no request. A new date asks again, once. If the service cannot be reached the stored forecast of an earlier day
 * still serves for as long as it has an hour close to the time.
 *
 * Returns `weather`: undefined while there is nothing yet, null when there is none (`reason` says why: "no-location" when the site has no saved location,
 * "unavailable" when it could not be read).
 */

export interface Stored {
  /** The India date (YYYY-MM-DD) this forecast was fetched on. */
  day: string;
  weather: Weather;
  /** The forecast moment by moment (hourly for two days), oldest first. */
  hours: HourPoint[];
}

type Reason = "no-location" | "unavailable";
type Answer = { ok: true; stored: Stored } | { ok: false; reason: Reason };

const KEY = (siteId: string) => `waytara:weather:v1:${siteId}`;
const IST_MS = 19_800_000;
const HOUR_MS = 3_600_000;
/** A forecast moment counts for the time now when it is at most this far from it. */
const NEAR_MS = 3 * HOUR_MS;

const istDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);

function readStored(siteId: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY(siteId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (typeof v.day !== "string" || !v.weather || !Array.isArray(v.hours) || !v.weather.now) return null;
    return v as Stored;
  } catch {
    return null;
  }
}

function writeStored(siteId: string, stored: Stored) {
  try {
    window.localStorage.setItem(KEY(siteId), JSON.stringify(stored));
  } catch {
    // storage can be blocked or full: the forecast then lasts for this page only
  }
}

/** One request at a time per site, however many parts of the page ask. */
const inflight = new Map<string, Promise<Answer>>();

function load(siteId: string, day: string): Promise<Answer> {
  const running = inflight.get(siteId);
  if (running) return running;
  const p = (async (): Promise<Answer> => {
    try {
      const res = await fetch("/api/weather", { cache: "no-store" });
      const body = (await res.json()) as { weather?: Weather; hours?: HourPoint[]; error?: string };
      if (body.weather && Array.isArray(body.hours)) {
        const stored: Stored = { day, weather: body.weather, hours: body.hours };
        writeStored(siteId, stored);
        return { ok: true, stored };
      }
      return { ok: false, reason: body.error === "no-location" ? "no-location" : "unavailable" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  })().finally(() => inflight.delete(siteId));
  inflight.set(siteId, p);
  return p;
}

/** The weather for the time `nowMs`: the stored conditions with "now" taken from the forecast hour that is current (the newest one that has started). Null when
 *  the forecast has no hour near that time. */
export function weatherAt(stored: Stored, nowMs: number): Weather | null {
  let best: HourPoint | null = null;
  let next: HourPoint | null = null;
  for (const h of stored.hours) {
    const t = Date.parse(h.time);
    if (t <= nowMs) best = h;
    else if (!next) next = h;
  }
  const near = best && nowMs - Date.parse(best.time) <= NEAR_MS ? best : next && Date.parse(next.time) - nowMs <= NEAR_MS ? next : null;
  if (!near) return null;
  const base = stored.weather.now;
  return {
    ...stored.weather,
    now: {
      ...base,
      tempC: near.tempC ?? base.tempC,
      condition: near.condition,
      night: near.night,
      humidityPct: near.humidityPct ?? base.humidityPct,
      windMs: near.windMs ?? base.windMs,
      cloudPct: near.cloudPct ?? base.cloudPct,
      windFromDeg: near.windFromDeg ?? base.windFromDeg,
      uvIndex: near.uvIndex ?? base.uvIndex,
      rainMm: near.rainMm ?? base.rainMm,
      at: near.time,
    },
  };
}

export function useSiteWeather(siteId: string | null): { weather: Weather | null | undefined; reason: Reason | null } {
  const [stored, setStored] = React.useState<Stored | null | undefined>(undefined);
  const [reason, setReason] = React.useState<Reason | null>(null);
  // "now", moved on at the top of every hour: that is when the conditions shown are worked out again from the stored forecast
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  // The stored forecast of today, else (once) a request.
  React.useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const ask = () => {
      const day = istDay(Date.now());
      const cached = readStored(siteId);
      if (cached && cached.day === day) {
        setStored(cached);
        setReason(null);
        return;
      }
      // an earlier day's forecast serves while the new one is on its way (and if it does not come)
      if (cached) setStored(cached);
      void load(siteId, day).then((answer) => {
        if (cancelled) return;
        if (answer.ok) {
          setStored(answer.stored);
          setReason(null);
        } else {
          setStored((prev) => prev ?? null);
          setReason(answer.reason);
        }
      });
    };
    ask();
    // at the top of every hour: the conditions move on to the next forecast hour, and a new date fetches its forecast (once)
    let timer = 0;
    const schedule = () => {
      const t = Date.now();
      timer = window.setTimeout(() => {
        setNowMs(Date.now());
        ask();
        schedule();
      }, (Math.floor(t / HOUR_MS) + 1) * HOUR_MS + 5_000 - t);
    };
    schedule();
    // a page that was hidden (a phone locked for hours) catches up when it is looked at again
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setNowMs(Date.now());
      ask();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [siteId]);

  const weather = React.useMemo(() => {
    if (stored === undefined) return undefined;
    if (stored === null) return null;
    return weatherAt(stored, nowMs);
  }, [stored, nowMs]);

  return { weather, reason: weather ? null : (reason ?? (stored ? "unavailable" : null)) };
}
