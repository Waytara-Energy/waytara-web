import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonChart, SkeletonChartCard, SkeletonHeadline, SkeletonLineTabs, SkeletonStatGrid } from "@/components/dashboard/skeletons";

/** Performance: the headline with the period picker at the right, the five tabs (Solar, Inverter, Battery, Load, Grid), a row of six figures and
 *  two columns of charts; and, under them, the cost and savings section (on the plans that have it). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <SkeletonHeadline figures={2} trailing="range" />
        <SkeletonLineTabs count={5} />
        <SkeletonStatGrid cols={6} />
        <SkeletonChartCard height={260} legend />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonChartCard height={200} />
          <SkeletonChartCard height={200} />
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <SkeletonStatGrid cols={4} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard>
            <SkeletonChart height={180} />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonChart height={180} />
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
