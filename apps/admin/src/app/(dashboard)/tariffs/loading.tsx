import { FormPanel, PageTitle, TableSkeleton, StatsSkeleton } from "@/components/skeletons";

/** Electricity rates: the title, the card to add a rate, and the table of rates. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-56" />
      <StatsSkeleton />
      <FormPanel fields={8} />
      <TableSkeleton cols={6} rows={6} twoLines={false} />
    </div>
  );
}
