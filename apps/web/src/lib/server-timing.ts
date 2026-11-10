/**
 * A tiny stopwatch for finding where the seconds go on the server: you mark the end of each step, and it can say how long each took. Two ways to see it:
 *  - a `Server-Timing` header on a response, which the browser's developer tools show under Network > the request > Timing;
 *  - one log line (visible in the host's logs), written only when the whole thing was slow, or always when WAYTARA_TIMING=on is set.
 * It costs a few microseconds and sends nothing anywhere.
 */

/** Anything slower than this (in milliseconds) is logged even without WAYTARA_TIMING. */
const SLOW_MS = 1000;

export interface Stopwatch {
  /** Ends the current step under this name (it began when the last step ended, or when the stopwatch started). */
  mark: (name: string) => void;
  /** Milliseconds since the stopwatch started. */
  total: () => number;
  /** "auth;dur=12, profile;dur=40, total;dur=55": the format of a Server-Timing header. */
  header: () => string;
  /** "auth 12 ms, profile 40 ms, total 55 ms": for a log line. */
  summary: () => string;
}

export function startStopwatch(): Stopwatch {
  const t0 = performance.now();
  let last = t0;
  const steps: [string, number][] = [];
  const total = () => performance.now() - t0;
  return {
    mark(name) {
      const now = performance.now();
      steps.push([name, now - last]);
      last = now;
    },
    total,
    header: () => [...steps, ["total", total()] as [string, number]].map(([n, d]) => `${n};dur=${d.toFixed(0)}`).join(", "),
    summary: () => [...steps, ["total", total()] as [string, number]].map(([n, d]) => `${n} ${d.toFixed(0)} ms`).join(", "),
  };
}

/** Writes one log line for a stopwatch when it was slow (or always, with WAYTARA_TIMING=on). */
export function logTiming(label: string, watch: Stopwatch): void {
  if (process.env.WAYTARA_TIMING === "on" || watch.total() > SLOW_MS) console.log(`[timing] ${label}: ${watch.summary()}`);
}
