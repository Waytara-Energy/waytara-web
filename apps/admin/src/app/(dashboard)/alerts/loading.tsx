import { PageTitle, StatsSkeleton, TableSkeleton } from "@/components/skeletons";

/** Alerts: the title, the four figures and the table of alerts. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-28" />
      <StatsSkeleton />
      <TableSkeleton cols={6} rows={8} />
    </div>
  );
}
