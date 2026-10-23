import { GAP_EXPLANATION, gapText, totalGapMs, durationText, type DataGap, type GapLine } from "@/lib/data-gaps";

/** The line under a chart that has a data gap in it: a small key for the pale red band, and when and for how long the readings were missing. */
export function DataGapNote({ gaps, className = "" }: { gaps: readonly DataGap[]; className?: string }) {
  if (gaps.length === 0) return null;
  const shown = gaps.slice(0, 3);
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${className}`}>
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
        <span aria-hidden className="size-2.5 rounded-sm border border-destructive/40 bg-destructive/15" />
        No data
      </span>
      {shown.map((g) => (
        <span key={g.fromMs} className="tabular-nums">
          {gapText(g)}
        </span>
      ))}
      {gaps.length > shown.length && <span>and {gaps.length - shown.length} more ({durationText(totalGapMs(gaps))} in all)</span>}
    </p>
  );
}

/** What a gap means, for a tooltip or a line in a report. */
export const GAP_MEANING = "The inverter was offline or its connection was lost, so no readings arrived.";

/** The "Data gaps" card of the Reports page: when the device sent no readings, each period on a row with its length. Nothing without gaps. */
export function DataGapsCard({ lines, summary }: { lines: readonly GapLine[]; summary: string }) {
  if (lines.length === 0) return null;
  const shown = lines.slice(0, 12);
  return (
    <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-full bg-destructive/70" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Data gaps</h3>
          <p className="text-xs text-muted-foreground">{summary}. {GAP_EXPLANATION}</p>
          <ul className="mt-3 divide-y divide-destructive/15 text-sm">
            {shown.map((l, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
                <span className="tabular-nums text-foreground">
                  {l.from}
                  {l.to !== l.from && <span className="text-muted-foreground"> to </span>}
                  {l.to !== l.from && l.to}
                </span>
                <span className="text-xs font-medium tabular-nums text-destructive">{l.length}</span>
              </li>
            ))}
          </ul>
          {lines.length > shown.length && <p className="mt-2 text-xs text-muted-foreground">and {lines.length - shown.length} more periods</p>}
        </div>
      </div>
    </section>
  );
}
