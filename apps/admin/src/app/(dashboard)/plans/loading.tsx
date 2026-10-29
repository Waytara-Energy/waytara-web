import { PageTitle } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Plans: the title, the row of plan tabs, the form's cards on the left and the preview card on the right. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-28" />
      <Skeleton className="h-10 w-[28rem] max-w-full rounded-lg" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-6">
          {[56, 64, 40, 72].map((h, i) => (
            <Skeleton key={i} className="rounded-xl" style={{ height: `${h * 4}px` }} />
          ))}
        </div>
        <Skeleton className="h-[26rem] rounded-xl" />
      </div>
    </div>
  );
}
