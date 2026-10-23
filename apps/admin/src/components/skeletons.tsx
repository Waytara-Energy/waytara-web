import { Skeleton } from "@/components/ui/skeleton";

/**
 * The pieces of every admin page's `loading.tsx`: the page title with its line, filter pills, a table, rows of cards, a form card. Each loading file
 * puts them together in the order of its own page, in the same container, so the page does not jump when it arrives. (The dashboard's own `main`
 * already has the padding: a loading file must not add any.)
 */

export function PageTitle({ width = "w-48", withAction = false }: { width?: string; withAction?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className={`h-8 ${width}`} />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      {withAction && (
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      )}
    </div>
  );
}

/** Rounded filter pills in one or two groups (leads' statuses, the audit log's entities and actions). */
export function FilterPills({ groups = [5] }: { groups?: number[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {groups.map((n, g) => (
        <div key={g} className={g > 0 ? "flex flex-wrap gap-2 border-l border-border pl-4" : "flex flex-wrap gap-2"}>
          {Array.from({ length: n }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A table with a header row of small labels and rows whose first cell has a name and a line under it. */
export function TableSkeleton({ cols = 5, rows = 8, twoLines = true }: { cols?: number; rows?: number; twoLines?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-6 bg-card px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) =>
              c === 0 && twoLines ? (
                <div key={c} className="w-40 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ) : (
                <Skeleton key={c} className={c === 0 ? "h-4 w-40" : "h-4 w-20"} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A list of collapsed cards, each with a coloured tag, a line of text and a date at the right (the audit log and device activity). */
export function RowCards({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** A bordered card, with an optional title line. */
export function Panel({ title = true, children, className = "" }: { title?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-3 rounded-lg border border-border bg-card p-4 ${className}`}>
      {title && <Skeleton className="h-4 w-40" />}
      {children}
    </div>
  );
}

/** A form card: a title, a grid of labelled fields and a button. */
export function FormPanel({ fields = 4, grid = "sm:grid-cols-2 lg:grid-cols-4", title = true, button = true }: { fields?: number; grid?: string; title?: boolean; button?: boolean }) {
  return (
    <Panel title={title}>
      <div className={`grid gap-3 ${grid}`}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
      {button && <Skeleton className="h-9 w-28 rounded-md" />}
    </Panel>
  );
}

/** A plan's card: its name, a few labelled fields and a button. */
export function PlanCardSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <Skeleton className="h-4 w-24" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
      <div className="space-y-2 border-t border-border pt-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  );
}

/** A "back" link above a title (the pages under Devices and Leads). */
export function BackLink() {
  return <Skeleton className="h-4 w-28" />;
}

/** A card with a heading row and a grid of labelled values (a lead's submission, a site's details). */
export function DetailPanel({ rows = 6 }: { rows?: number }) {
  return (
    <Panel>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </dl>
    </Panel>
  );
}
