import { SkeletonList, SkeletonPageHeader } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-2xl space-y-6">
      <SkeletonPageHeader withAction />
      <SkeletonList rows={3} />
    </div>
  );
}
