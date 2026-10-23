import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/dashboard/skeletons";

/** The shape of the page: the hero (picture, name, chips), the row of tabs, then two columns of cards. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="flex gap-6 overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <Skeleton key={i} className="h-5 w-24 shrink-0" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {[0, 1].map((c) => (
          <SkeletonCard key={c} title={false}>
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
