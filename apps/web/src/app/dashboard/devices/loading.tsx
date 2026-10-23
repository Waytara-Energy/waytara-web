import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonFieldRows, SkeletonHeadline, SkeletonLineTabs } from "@/components/dashboard/skeletons";

/** Devices: the headline (the open tab's figure and the device's status), the tabs (Details, Settings by category), then cards of details. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonHeadline figures={3} />
      <SkeletonLineTabs count={6} />
      <div className="space-y-4">
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard>
            <SkeletonFieldRows rows={6} />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonFieldRows rows={6} />
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
