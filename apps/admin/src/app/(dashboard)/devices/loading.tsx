import { PageTitle, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The stock catalog: the title with its two buttons, the overview cards, and the table of device models. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-52" withAction />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <TableSkeleton cols={6} rows={8} />
    </div>
  );
}
