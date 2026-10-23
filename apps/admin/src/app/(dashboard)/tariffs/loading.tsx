import { FormPanel, PageTitle, TableSkeleton } from "@/components/skeletons";

/** Electricity rates: the title, the card to add a rate, and the table of rates. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-56" />
      <FormPanel fields={8} />
      <TableSkeleton cols={6} rows={6} twoLines={false} />
    </div>
  );
}
