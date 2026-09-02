import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonChart, SkeletonPageHeader, SkeletonStatGrid } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatGrid cols={2} />
      <div className="space-y-3 rounded-xl border border-theme-border bg-theme-bg p-4">
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
        <SkeletonChart />
      </div>
      <SkeletonCard>
        <SkeletonChart />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonChart />
      </SkeletonCard>
    </div>
  );
}
