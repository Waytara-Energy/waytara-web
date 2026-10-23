// Data gaps: the stretches when a device sent no readings (the inverter was offline, or its connection was lost). Found from the readings
// themselves, so they show up the same way in the charts and in the reports. Pure, so the rules are tested.

/** The least a stretch of missing readings must last to be called a gap (a missed slot or two is not worth a mark). */
export const MIN_GAP_MS = 30 * 60_000;

export interface DataGap {
  /** the first moment with no reading, and the end of the last such moment (or "now" for a gap that is still going on) */
  fromMs: number;
  toMs: number;
  /** the readings have not come back yet */
  ongoing: boolean;
}

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

/** "45 min", "1 h 25 min", "2 h", "1 day 3 h": how long a gap lasted. */
export function durationText(ms: number): string {
  const total = Math.max(0, Math.round(ms / MIN_MS));
  if (total < 1) return "under a minute";
  if (total < 60) return `${total} min`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"}${hours > 0 ? ` ${hours} h` : ""}`;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

/**
 * The gaps in a series of time slots. `slots` are the start times (ms, ascending) of equal slots `slotMs` wide and `has` says whether each slot has a
 * reading. Only stretches between two readings count, plus the stretch since the last reading (the readings have stopped), never the time before the
 * first reading (the device may not have existed yet). A stretch must last at least `minMs`. `endMs` closes the window early (a report of a day that
 * is over); a gap that reaches "now" is `ongoing`.
 */
export function findGaps(slots: readonly number[], has: readonly boolean[], slotMs: number, nowMs: number, opts: { minMs?: number; endMs?: number; trailing?: boolean } = {}): DataGap[] {
  const minMs = opts.minMs ?? MIN_GAP_MS;
  const endMs = Math.min(opts.endMs ?? nowMs, nowMs);
  const reachesNow = (opts.endMs ?? nowMs) >= nowMs;
  const n = Math.min(slots.length, has.length);
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (slots[i] > endMs) break;
    if (has[i]) {
      first = i;
      break;
    }
  }
  if (first < 0) return [];

  const out: DataGap[] = [];
  let runStart = -1;
  let lastSeen = first;
  const close = (endExclusive: number, ongoing: boolean) => {
    const fromMs = slots[runStart];
    const toMs = Math.min(slots[endExclusive - 1] + slotMs, endMs);
    if (toMs - fromMs >= minMs) out.push({ fromMs, toMs, ongoing });
  };
  for (let i = first; i < n; i++) {
    if (slots[i] > endMs) break;
    // slots that are not next to each other (a report of the hours of each day only) end a stretch: the time between them was not asked for
    if (runStart >= 0 && i > first && slots[i] - slots[i - 1] > slotMs) {
      close(i, false);
      runStart = -1;
    }
    lastSeen = i;
    if (!has[i]) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      close(i, false);
      runStart = -1;
    }
  }
  if (runStart >= 0 && opts.trailing !== false) close(lastSeen + 1, reachesNow);
  return out;
}

const IST_MS = 19_800_000;
const istParts = (ms: number) => new Date(ms + IST_MS).toISOString();

/** "10:15" (India time). */
export const clockText = (ms: number): string => istParts(ms).slice(11, 16);

/** "23 Oct" (India time). */
export const dayText = (ms: number): string => new Date(ms + IST_MS).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** "10:15 to 11:40", or "23 Oct 22:10 to 24 Oct 06:30" when it crosses midnight; a gap still going on says "since 10:15". */
export function gapRangeText(g: DataGap, withDate = false): string {
  const sameDay = istParts(g.fromMs).slice(0, 10) === istParts(g.toMs - 1).slice(0, 10);
  const from = withDate || !sameDay ? `${dayText(g.fromMs)} ${clockText(g.fromMs)}` : clockText(g.fromMs);
  if (g.ongoing) return `since ${from}`;
  const to = withDate || !sameDay ? `${dayText(g.toMs)} ${clockText(g.toMs)}` : clockText(g.toMs);
  return `${from} to ${to}`;
}

/** The whole gap in a line: "10:15 to 11:40 (1 h 25 min)". */
export const gapText = (g: DataGap, withDate = false): string => `${gapRangeText(g, withDate)} (${durationText(g.toMs - g.fromMs)}${g.ongoing ? " so far" : ""})`;

/** The total time missing. */
export const totalGapMs = (gaps: readonly DataGap[]): number => gaps.reduce((n, g) => n + (g.toMs - g.fromMs), 0);

// ---- why a gap happened ---------------------------------------------------------------------------------------------------------------

/** An outage the platform recorded: when it began and what kind it was ("offline": the monitoring unit stopped checking in; "device_unreachable": the unit is online but the inverter does not answer it). */
export interface OutageEvent {
  sinceMs: number;
  cause: string | null;
}

export type GapCause = "unit_offline" | "inverter_unreachable" | "unknown";

export interface GapReason {
  cause: GapCause;
  /** a few words: what was wrong */
  title: string;
  /** a sentence or two: what it means and what to look at */
  detail: string;
}

const REASONS: Record<GapCause, Omit<GapReason, "cause">> = {
  unit_offline: {
    title: "Monitoring unit offline",
    detail: "The monitoring unit stopped checking in, so power or internet at the site was probably down. Nothing could be recorded meanwhile.",
  },
  inverter_unreachable: {
    title: "Inverter not answering",
    detail: "The monitoring unit stayed online but the inverter did not answer it. Check the cable between them, or the inverter itself.",
  },
  unknown: {
    title: "No readings received",
    detail: "Readings stopped arriving and no cause was recorded. The device's health check shows what it is doing now.",
  },
};

/** The words for a cause (what was wrong, and what to look at). */
export const reasonOf = (cause: GapCause): GapReason => ({ cause, ...REASONS[cause] });

/** How far from the start of a gap the recorded start of an outage may be to count as the same event (the platform notes an outage a little after it begins). */
const MATCH_SLACK_MS = 30 * 60_000;

/** The reason for a gap: the recorded outage that began at about the same time (or during it). Without one, the cause is not known. */
export function explainGap(g: DataGap, outages: readonly OutageEvent[]): GapReason {
  let best: OutageEvent | null = null;
  for (const o of outages) {
    if (o.sinceMs < g.fromMs - MATCH_SLACK_MS || o.sinceMs > g.toMs) continue;
    if (!best || Math.abs(o.sinceMs - g.fromMs) < Math.abs(best.sinceMs - g.fromMs)) best = o;
  }
  const cause: GapCause = best?.cause === "offline" ? "unit_offline" : best?.cause === "device_unreachable" ? "inverter_unreachable" : "unknown";
  return reasonOf(cause);
}

// ---- whole days (the statements and period reports work in days) ----------------------------------------------------------------------

export interface DayGap {
  /** the first and last day with no reading, YYYY-MM-DD */
  from: string;
  to: string;
  days: number;
}

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const dayAfter = (day: string, n: number) => new Date(dayMs(day) + n * DAY_MS).toISOString().slice(0, 10);

/**
 * The runs of days with no reading between `from` and `to` (both included): only after the first day with a reading (the device may not have
 * existed before), up to `to`. `withData` is the days that have a reading. Today is not a gap while it is young: pass `to` as the last day that is over
 * unless today already is missing too.
 */
export function findDayGaps(withData: Iterable<string>, from: string, to: string): DayGap[] {
  const have = new Set(withData);
  let first: string | null = null;
  for (let d = from; d <= to; d = dayAfter(d, 1)) {
    if (have.has(d)) {
      first = d;
      break;
    }
  }
  if (!first) return [];
  const out: DayGap[] = [];
  let start: string | null = null;
  let count = 0;
  for (let d = first; d <= to; d = dayAfter(d, 1)) {
    if (!have.has(d)) {
      if (start === null) start = d;
      count++;
    } else if (start !== null) {
      out.push({ from: start, to: dayAfter(d, -1), days: count });
      start = null;
      count = 0;
    }
  }
  if (start !== null) out.push({ from: start, to, days: count });
  return out;
}

const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** "12 Oct to 14 Oct (3 days)", or "12 Oct (1 day)". */
export function dayGapText(g: DayGap): string {
  const span = g.from === g.to ? shortDay(g.from) : `${shortDay(g.from)} to ${shortDay(g.to)}`;
  return `${span} (${g.days} ${g.days === 1 ? "day" : "days"})`;
}

export const totalGapDays = (gaps: readonly DayGap[]): number => gaps.reduce((n, g) => n + g.days, 0);

// ---- the lines of a report ------------------------------------------------------------------------------------------------------------

/** One gap as a row of a report: when it began, when it ended (or that it has not), and how long. */
export interface GapLine {
  from: string;
  to: string;
  length: string;
}

/** "23 Oct 2026, 10:15" (India time). */
function stamp(ms: number): string {
  const d = new Date(ms + IST_MS);
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}, ${istParts(ms).slice(11, 16)}`;
}

/** The report rows of time gaps. A gap that is still going on says so instead of an end. */
export const gapLines = (gaps: readonly DataGap[]): GapLine[] =>
  gaps.map((g) => ({ from: stamp(g.fromMs), to: g.ongoing ? "still no readings" : stamp(g.toMs), length: durationText(g.toMs - g.fromMs) }));

const longDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The report rows of whole-day gaps. */
export const dayGapLines = (gaps: readonly DayGap[]): GapLine[] => gaps.map((g) => ({ from: longDay(g.from), to: longDay(g.to), length: `${g.days} ${g.days === 1 ? "day" : "days"}` }));

/** "2 periods, 3 h 10 min without readings". */
export const gapsSummary = (gaps: readonly DataGap[]): string => `${gaps.length} ${gaps.length === 1 ? "period" : "periods"}, ${durationText(totalGapMs(gaps))} without readings`;

/** "2 periods, 4 days without readings". */
export const dayGapsSummary = (gaps: readonly DayGap[]): string => `${gaps.length} ${gaps.length === 1 ? "period" : "periods"}, ${totalGapDays(gaps)} ${totalGapDays(gaps) === 1 ? "day" : "days"} without readings`;

/** The sentence every report puts with its gaps. */
export const GAP_EXPLANATION = "The device sent no readings in these periods (it was offline, or its connection was lost). The figures for them are missing, not zero.";

/** The rows as CSV lines (a blank line, a heading, a header row and the gaps), to add to the end of a report file; empty when there are none. */
export function gapsCsv(lines: readonly GapLine[], summary: string, esc: (cell: string | number) => string): string[] {
  if (lines.length === 0) return [];
  return ["", [esc("Data gaps"), esc(summary)].join(","), [esc("From"), esc("To"), esc("Length")].join(","), ...lines.map((l) => [l.from, l.to, l.length].map(esc).join(",")), esc(GAP_EXPLANATION)];
}
