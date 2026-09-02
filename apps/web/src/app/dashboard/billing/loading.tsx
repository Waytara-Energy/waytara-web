import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonTable } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-2xl space-y-6">
      <Skeleton className="h-7 w-36" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SkeletonCard>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </SkeletonCard>
      </div>

      <SkeletonCard>
        <SkeletonTable rows={3} cols={4} />
      </SkeletonCard>
    </div>
  );
}
