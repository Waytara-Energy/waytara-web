import { FormPanel, PageTitle, TableSkeleton } from "@/components/skeletons";

/** Employees: the title, the card to invite someone, and the list of staff. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-40" />
      <FormPanel fields={3} grid="sm:grid-cols-3" />
      <TableSkeleton cols={5} rows={6} />
    </div>
  );
}
