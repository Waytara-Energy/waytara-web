import { PageTitle, TableSkeleton, StatsSkeleton } from "@/components/skeletons";

/** Onboarding: the title and the table of customers moving through the pipeline. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-40" />
      <StatsSkeleton />
      <TableSkeleton cols={3} rows={8} />
    </div>
  );
}
