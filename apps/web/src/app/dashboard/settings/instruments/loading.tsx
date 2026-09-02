import { SkeletonCard, SkeletonFieldRows, SkeletonPageHeader, SkeletonTabsBar } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <SkeletonPageHeader />
      <SkeletonTabsBar count={7} />
      <SkeletonCard>
        <SkeletonFieldRows rows={6} />
      </SkeletonCard>
    </div>
  );
}
