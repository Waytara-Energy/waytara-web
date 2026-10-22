import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/dashboard/skeletons";

/** The shape of the page: the headline, then the map beside the cards of site details. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-xl" />
        <SkeletonCard>
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}
