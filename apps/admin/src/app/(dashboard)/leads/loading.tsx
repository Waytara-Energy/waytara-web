import { PageTitle, TableSkeleton, StatsSkeleton } from "@/components/skeletons";

/** Leads: the title, the status pills and the table of leads. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-28" />
      <StatsSkeleton />
      <TableSkeleton cols={6} rows={8} />
    </div>
  );
}
