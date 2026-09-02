import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonCard,
  SkeletonFlowDiagram,
  SkeletonList,
  SkeletonPageHeader,
  SkeletonStatGrid,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonPageHeader />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <SkeletonCard title={false}>
        <SkeletonFlowDiagram />
      </SkeletonCard>

      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <SkeletonStatGrid cols={4} />
      </div>

      <div className="border-t border-theme-border pt-6">
        <Skeleton className="mb-3 h-4 w-28" />
        <SkeletonList rows={2} />
      </div>
    </div>
  );
}
