import { Skeleton } from "@/components/ui/skeleton";

/** A stock item's page: its title, the four figures, the form's cards on the left and the "in use" card on the right. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-6">
          {[56, 52, 52, 56].map((h, i) => (
            <Skeleton key={i} className="rounded-xl" style={{ height: `${h * 4}px` }} />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
