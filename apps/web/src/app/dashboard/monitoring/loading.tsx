import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonChart, SkeletonPageHeader } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonPageHeader />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>

      <SkeletonCard>
        <SkeletonChart />
      </SkeletonCard>

      <SkeletonCard>
        <SkeletonChart />
      </SkeletonCard>

      <SkeletonCard>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 rounded-lg border border-theme-border p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
