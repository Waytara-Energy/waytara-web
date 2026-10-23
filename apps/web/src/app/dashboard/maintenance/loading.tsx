import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonHeadline, SkeletonLineTabs } from "@/components/dashboard/skeletons";

/** Maintenance: the headline with the "Get support" button, the three tabs, then the checks (left) and the temperatures (right). */
export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonHeadline figures={0} trailing="button" />
      <SkeletonLineTabs count={3} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SkeletonCard>
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
        <div className="lg:col-span-2">
          <SkeletonCard>
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
