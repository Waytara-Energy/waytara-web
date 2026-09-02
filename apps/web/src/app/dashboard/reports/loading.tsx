import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPageHeader, SkeletonTable } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <SkeletonPageHeader />

      <div className="space-y-3 rounded-xl border border-theme-border bg-theme-bg p-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-theme-border bg-theme-bg p-4">
        <Skeleton className="h-4 w-40" />
        <SkeletonTable rows={5} cols={2} />
      </div>
    </div>
  );
}
