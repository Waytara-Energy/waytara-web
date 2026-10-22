import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/dashboard/skeletons";

/** The shape of the page: the headline, the two tabs, then the plan and subscription cards. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
      <div className="flex gap-6">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </SkeletonCard>
      </div>
    </div>
  );
}
