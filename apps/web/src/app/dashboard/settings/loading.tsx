import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonLineTabs, SkeletonSettingsCard } from "@/components/dashboard/skeletons";

/** Application Settings: the hero (a picture with its ring, the name, the e-mail, the chips, and the buttons at the right), the ten tabs, and two
 *  columns of cards (each with its round icon, title and rows). */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <Skeleton className="size-[88px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 basis-64 space-y-3">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <SkeletonLineTabs count={10} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <SkeletonSettingsCard rows={4} />
          <SkeletonSettingsCard rows={3} />
        </div>
        <div className="space-y-5">
          <SkeletonSettingsCard rows={3} />
          <SkeletonSettingsCard rows={4} />
        </div>
      </div>
    </div>
  );
}
