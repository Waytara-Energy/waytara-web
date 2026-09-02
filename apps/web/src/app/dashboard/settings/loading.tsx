import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="max-w-md space-y-6">
      <Skeleton className="h-7 w-52" />
      <SkeletonCard title={false}>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  );
}
