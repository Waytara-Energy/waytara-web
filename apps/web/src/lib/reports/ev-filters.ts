// What the EV charging report can be narrowed to: the status of a charge, the hours of the day it started in, and charges that delivered energy.
// Pure, so the page (in the browser) and the downloads (on the server) cut the same sessions the same way.

import type { EvPerfSession } from "@/lib/ev-perf-stats";
import { sessionEnergyKwh, sessionStatusLabel } from "@/lib/ev-sessions";
import { addDays } from "./period-math";

/** The three views of the report: every charge, one row per day, and one month in the form of a statement. */
export type EvReportMode = "sessions" | "daily" | "statement";
export const EV_REPORT_MODES: EvReportMode[] = ["sessions", "daily", "statement"];

export interface EvReportFilters {
  /** "all", or one status of a charge (completed, active, aborted ...). */
  status: string;
  /** Only charges that delivered energy (leaves out the empty ones: plugged in, nothing drawn). */
  withEnergy: boolean;
  /** The hours of the day a charge started in, India time (HH:MM); both null = all day. */
  fromTime: string | null;
  toTime: string | null;
}

export const NO_EV_FILTERS: EvReportFilters = { status: "all", withEnergy: false, fromTime: null, toTime: null };

const IST_MS = 19_800_000;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutesOfDay = (iso: string) => {
  const d = new Date(Date.parse(iso) + IST_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** The sessions that pass the filters. */
export function filterEvSessions(sessions: readonly EvPerfSession[], f: EvReportFilters): EvPerfSession[] {
  const hasWindow = f.fromTime !== null && f.toTime !== null && TIME.test(f.fromTime) && TIME.test(f.toTime) && !(f.fromTime === "00:00" && f.toTime >= "23:59");
  const from = hasWindow ? toMinutes(f.fromTime!) : 0;
  const to = hasWindow ? toMinutes(f.toTime!) : 24 * 60;
  return sessions.filter((s) => {
    if (f.status !== "all" && s.status !== f.status) return false;
    if (f.withEnergy && !((sessionEnergyKwh(s) ?? 0) > 0)) return false;
    if (hasWindow) {
      const m = minutesOfDay(s.started_at);
      if (m < from || m > to) return false;
    }
    return true;
  });
}

/** The filters in a query string (nothing for a filter left at its default), for the download links. */
export function filtersQuery(f: EvReportFilters): string {
  const p: string[] = [];
  if (f.status !== "all") p.push(`status=${encodeURIComponent(f.status)}`);
  if (f.withEnergy) p.push("withEnergy=1");
  if (f.fromTime && f.toTime && !(f.fromTime === "00:00" && f.toTime >= "23:59")) p.push(`fromTime=${f.fromTime}`, `toTime=${f.toTime}`);
  return p.join("&");
}

/** The filters from a query string; anything that is not valid is left at its default. */
export function parseEvFilters(get: (key: string) => string | null): EvReportFilters {
  const status = get("status") ?? "all";
  const fromTime = get("fromTime");
  const toTime = get("toTime");
  const window = fromTime && toTime && TIME.test(fromTime) && TIME.test(toTime);
  return {
    status: /^[a-z_]{1,20}$/.test(status) ? status : "all",
    withEnergy: get("withEnergy") === "1",
    fromTime: window ? fromTime : null,
    toTime: window ? toTime : null,
  };
}

/** The filters in words, for the line under a report's title; empty when nothing is filtered. */
export function filtersNote(f: EvReportFilters): string[] {
  const out: string[] = [];
  if (f.status !== "all") out.push(`Status: ${sessionStatusLabel(f.status).label}`);
  if (f.withEnergy) out.push("Only charges that delivered energy");
  if (f.fromTime && f.toTime && !(f.fromTime === "00:00" && f.toTime >= "23:59")) out.push(`Started between ${f.fromTime} and ${f.toTime}`);
  return out;
}

/** The first and last day of a month (YYYY-MM), the last never past `today`. */
export function monthBounds(month: string, today: string): { from: string; to: string } {
  const from = `${month}-01`;
  const next = new Date(Date.parse(`${from}T00:00:00Z`));
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = addDays(next.toISOString().slice(0, 10), -1);
  return { from, to: last > today ? today : last };
}

/** The months (YYYY-MM, newest first) from the first day with a charge to today. */
export function monthsBetween(firstDay: string | null, today: string): string[] {
  const out: string[] = [];
  const last = today.slice(0, 7);
  let m = (firstDay ?? today).slice(0, 7);
  for (let i = 0; i < 36 && m <= last; i++) {
    out.push(m);
    const d = new Date(Date.parse(`${m}-15T00:00:00Z`));
    d.setUTCMonth(d.getUTCMonth() + 1);
    m = d.toISOString().slice(0, 7);
  }
  return out.reverse();
}
