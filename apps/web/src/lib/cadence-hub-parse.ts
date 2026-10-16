// What the readings service (the hub, GET /v1/reports/cadence) answers, turned into the per-value series the dashboard uses. Pure (no server
// imports) so the rules are tested.
//
//   { columns: [{key, label, unit}, ...], rows: [[epoch ms, value or null, ...], ...], truncated, from, to }
//
// A row is one moment at which any of the picked values was read; a value not read at that moment is null and is skipped.

import type { CadenceSeriesMap } from "./cadence-parse";

export interface HubRows {
  columns: { key: string }[];
  rows: (number | null)[][];
}

/** Adds the rows of one answer to the series (which already hold an array for every wanted key). */
export function addRows(series: CadenceSeriesMap, answer: HubRows): void {
  const cols = answer.columns.map((c) => c.key);
  for (const row of answer.rows) {
    const t = row[0];
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    for (let i = 0; i < cols.length; i++) {
      const v = row[i + 1];
      const key = cols[i]!;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const list = series[key];
      if (list) list.push([Math.round(t), v]);
    }
  }
}

/** The time range cut into consecutive pieces of at most `stepMs` (oldest first). */
export function timeChunks(fromMs: number, toMs: number, stepMs: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = fromMs; a < toMs; a += stepMs) out.push([a, Math.min(a + stepMs, toMs)]);
  return out;
}

/** The keys cut into groups of at most `size` (the service takes a limited number of values per request). */
export function keyChunks(keys: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < keys.length; i += size) out.push(keys.slice(i, i + size));
  return out;
}

/** Separates the asked-for keys into those this person may read (the service lists them) and those it does not know. */
export function splitKnown(keys: string[], available: Iterable<string>): { use: string[]; unknown: string[] } {
  const have = new Set(available);
  const seen = new Set<string>();
  const use: string[] = [];
  const unknown: string[] = [];
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    (have.has(k) ? use : unknown).push(k);
  }
  return { use, unknown };
}
