import { GAP_EXPLANATION, type GapLine } from "@/lib/data-gaps";

/** The "Data gaps" card (Reports and Monitoring): when the device sent no readings, each period on a row (when it began, what was wrong, how long)
 *  with the same two-line look as the device menu. Nothing without gaps. */
export function DataGapsCard({ lines, summary }: { lines: readonly GapLine[]; summary: string }) {
  if (lines.length === 0) return null;
  const shown = lines.slice(0, 12);
  return (
    <section className="overflow-hidden rounded-2xl border border-destructive/25 bg-card">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Data gaps</h3>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
      </div>
      <ul className="divide-y border-t text-xs">
        {shown.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-2.5 sm:px-5">
            <span className="min-w-0">
              <span className="block text-sm font-medium tabular-nums text-foreground">{l.ongoing ? `since ${l.from}` : l.to === l.from ? l.from : `${l.from} to ${l.to}`}</span>
              {l.reason && <span className="block text-muted-foreground">{l.reason}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{l.length}</span>
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-3 text-xs leading-snug text-muted-foreground sm:px-5">
        {lines.length > shown.length && <>and {lines.length - shown.length} more periods. </>}
        {GAP_EXPLANATION}
      </p>
    </section>
  );
}
