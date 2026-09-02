import { SkeletonCard, SkeletonChart, SkeletonPageHeader, SkeletonStatGrid } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatGrid cols={4} />
      <div className="space-y-3 rounded-xl border border-theme-border bg-theme-bg p-4">
        <SkeletonChart />
      </div>
      <SkeletonCard>
        <SkeletonStatGrid cols={2} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonStatGrid cols={2} />
      </SkeletonCard>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SkeletonCard>
          <SkeletonChart height={64} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonChart height={64} />
        </SkeletonCard>
      </div>
    </div>
  );
}
