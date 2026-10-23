import { SkeletonChartCard, SkeletonHeadline, SkeletonLineTabs, SkeletonStatusCard } from "@/components/dashboard/skeletons";

/** Monitoring: the open tab's headline (a round icon, what the number is, the number), the tabs (Hub, Solar, Battery, Load, Grid ...), then the
 *  Hub: a row of status cards and the live charts. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonHeadline figures={0} trailing="pill" />
      <SkeletonLineTabs count={6} />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonStatusCard key={i} />
          ))}
        </div>
        <SkeletonChartCard height={240} legend />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonChartCard height={200} />
          <SkeletonChartCard height={200} />
        </div>
      </div>
    </div>
  );
}
