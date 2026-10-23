import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonChart, SkeletonHeadline, SkeletonLineTabs, SkeletonStatGrid, SkeletonTable } from "@/components/dashboard/skeletons";

/** Reports: the headline with the period picker, the three tabs (Summary, Energy, Generate), then the summary: a row of figures, a chart and the
 *  month's statement list. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonHeadline figures={2} trailing="range" />
      <SkeletonLineTabs count={3} />
      <div className="space-y-4">
        <SkeletonStatGrid cols={4} />
        <SkeletonCard>
          <SkeletonChart height={240} />
        </SkeletonCard>
        <SkeletonCard>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <SkeletonTable rows={4} cols={3} />
        </SkeletonCard>
      </div>
    </div>
  );
}
