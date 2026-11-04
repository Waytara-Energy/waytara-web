import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonStatTile, SkeletonTable } from "@/components/dashboard/skeletons";

/** Charging sessions: the summary card (a title, a line and four figures) and the list of sessions. */
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonStatTile key={i} />
          ))}
        </div>
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
