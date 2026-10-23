import { GAP_EXPLANATION, type GapLine } from "@/lib/data-gaps";

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
