import { SkeletonList, SkeletonPageHeader } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonList rows={2} />
    </div>
  );
}
