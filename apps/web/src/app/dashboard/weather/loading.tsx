import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonHeadline } from "@/components/dashboard/skeletons";

/** Weather: the headline, a row of the days ahead (each a small card), then the open day's cards. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonHeadline figures={2} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-border bg-card p-3">
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="mx-auto size-8 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <div className="space-y-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
