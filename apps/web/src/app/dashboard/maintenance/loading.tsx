import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonPageHeader, SkeletonTable } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-2xl space-y-6">
      <SkeletonPageHeader withAction />

      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <SkeletonCard title={false}>
          <Skeleton className="h-12 w-full rounded-lg" />
        </SkeletonCard>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
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

      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <SkeletonTable rows={3} />
      </div>
    </div>
  );
}
