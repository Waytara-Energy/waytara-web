import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared building blocks for every dashboard route's `loading.tsx` —
 * composed per-page to roughly match that page's real layout (stat row
 * here, a chart there) so the swap from skeleton to real content doesn't
 * jump the page around. Deliberately approximate, not pixel-exact: the
 * goal is "nothing shifts by more than a few px", not a perfect replica.
 */

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

export function SkeletonStatTile() {
  return (
    <div className="space-y-2 rounded-lg border border-theme-border bg-theme-surface p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export function SkeletonStatGrid({ cols = 4 }: { cols?: 2 | 4 }) {
  const gridClass = cols === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonStatTile key={i} />
      ))}
    </div>
  );
}

export function SkeletonCard({
  title = true,
  children,
}: {
  title?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-theme-border bg-theme-bg p-4">
      {title && <Skeleton className="h-4 w-32" />}
      {children}
    </div>
  );
}

export function SkeletonChart({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

export function SkeletonTable({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-theme-border">
      <div className="flex items-center gap-4 border-b border-theme-border bg-theme-surface p-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16 last:ml-auto" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-theme-border p-3 last:border-0">
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
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
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

/** Overview's energy-flow diagram — five node circles arranged the same
 *  way EnergyFlowDiagram lays them out, so the hero card doesn't collapse
 *  to a fraction of its real height while loading. */
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
        <div
          key={i}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
          style={pos}
        >
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTabsBar({ count = 7 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-theme-border bg-theme-surface p-1">
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
