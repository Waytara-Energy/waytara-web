import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFlowDiagram, SkeletonTodayCard } from "@/components/dashboard/skeletons";

/** The Overview while it loads: the same three columns as the page, sized to the screen the same way (two "today" cards on each side of the
 *  energy flow), so the numbers drop into place without the page moving or growing a scrollbar. */
export default function Loading() {
  const side = "grid min-h-0 grid-cols-2 gap-3 lg:h-full lg:grid-cols-1 lg:[grid-template-rows:1fr_1fr]";
  return (
    <div className="space-y-3">
      {/* the tabs (the site and each device) */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-72 max-w-full rounded-xl" />
      </div>
      <div className="grid gap-4 lg:h-[max(calc(100svh-9.75rem),30rem)] lg:grid-cols-[minmax(15rem,1fr)_minmax(0,42rem)_minmax(15rem,1fr)]">
        <div className={`${side} order-2 lg:order-1`}>
          <SkeletonTodayCard />
          <SkeletonTodayCard />
        </div>
        <div className="order-1 flex min-w-0 items-center justify-center lg:order-2">
          <div className="w-full">
            <SkeletonFlowDiagram />
          </div>
        </div>
        <div className={`${side} order-3`}>
          <SkeletonTodayCard />
          <SkeletonTodayCard />
        </div>
      </div>
    </div>
  );
}
