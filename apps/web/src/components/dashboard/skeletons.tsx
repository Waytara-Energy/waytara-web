import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The building blocks of every dashboard route's `loading.tsx` (and of the places inside a page that wait for data). Each loading file is put
 * together from these in the shape of its own page: the same headline, tabs, cards and columns, in the same places, so that when the real page
 * arrives nothing jumps. The blocks shimmer (see Skeleton). They are approximate in their contents, not in their layout.
 */

/** The big card every page puts its content in (the same look as SettingsCard and the chart cards). */
const SURFACE = "rounded-2xl border border-border bg-card shadow-sm";

/** A plain page title with a line under it (pages that have no headline). */
export function SkeletonPageHeader({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />}
    </div>
  );
}

/** The headline of Performance, Monitoring, Maintenance, Devices, Reports, Billing and Weather: a round icon, a small label, a big figure, and
 *  (on a wide screen) a few more figures; `trailing` is what sits at the right (a period picker, a button, a status). */
export function SkeletonHeadline({ figures = 2, trailing = null }: { figures?: number; trailing?: "range" | "button" | "pill" | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          {Array.from({ length: figures }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      </div>
      {trailing === "range" && (
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-14 rounded-lg" />
          ))}
        </div>
      )}
      {trailing === "button" && <Skeleton className="h-9 w-36 rounded-md" />}
      {trailing === "pill" && <Skeleton className="h-6 w-28 rounded-full" />}
    </div>
  );
}

/** The line tabs under a headline (an underline marks the open one). */
export function SkeletonLineTabs({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-6 overflow-hidden border-b border-border pb-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-20 shrink-0" />
      ))}
    </div>
  );
}

/** A card with room for whatever is put in it, and an optional title line. */
export function SkeletonCard({ title = true, className, children }: { title?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(SURFACE, "space-y-3 p-4", className)}>
      {title && <Skeleton className="h-4 w-32" />}
      {children}
    </div>
  );
}

/** A card of the settings pages: a round icon, a title and a line of description, then the card's rows. */
export function SkeletonSettingsCard({ rows = 3, children, className }: { rows?: number; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn(SURFACE, "space-y-5 p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-3/4 max-w-sm" />
        </div>
      </div>
      {children ?? (
        <div className="space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** One figure tile: a small label and a number (the rows of figures at the top of the Performance tabs). */
export function SkeletonStatTile() {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export function SkeletonStatGrid({ cols = 4 }: { cols?: 2 | 3 | 4 | 6 }) {
  const gridClass = cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-2 lg:grid-cols-3" : cols === 6 ? "grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={cn("grid gap-4", gridClass)}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonStatTile key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

/** A card with a title line and a chart: the chart cards of Monitoring and Performance. */
export function SkeletonChartCard({ height = 220, legend = false }: { height?: number; legend?: boolean }) {
  return (
    <SkeletonCard>
      <SkeletonChart height={height} />
      {legend && (
        <div className="flex gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      )}
    </SkeletonCard>
  );
}

/** A status card of Monitoring: an icon and a title, one big value and a status line. */
export function SkeletonStatusCard() {
  return (
    <div className={cn(SURFACE, "space-y-3 p-4")}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3.5 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-4 border-b border-border bg-muted/40 p-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16 last:ml-auto" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border p-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? "h-4 w-32" : "h-4 w-16 last:ml-auto"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Overview's energy-flow diagram: five node circles arranged the way EnergyFlowDiagram lays them out. */
export function SkeletonFlowDiagram() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm">
      {[
        { top: "10%", left: "50%" },
        { top: "50%", left: "12%" },
        { top: "50%", left: "50%" },
        { top: "50%", left: "88%" },
        { top: "90%", left: "50%" },
      ].map((pos, i) => (
        <div key={i} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5" style={pos}>
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTabsBar({ count = 7 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-24 rounded-lg" />
      ))}
    </div>
  );
}

export function SkeletonFieldRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** A big card of the Overview (a "today" card): a title with a round button, a figure with its line, and a chart that takes the rest. */
export function SkeletonTodayCard() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="size-9 shrink-0 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="min-h-28 flex-1 rounded-xl lg:min-h-0" />
    </div>
  );
}
