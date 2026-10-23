import { BackLink, FormPanel, PageTitle, TableSkeleton } from "@/components/skeletons";

/** Settings history: a back link, the title, the search row and the table of changes. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <BackLink />
        <PageTitle width="w-48" />
      </div>
      <FormPanel title={false} fields={3} grid="sm:grid-cols-3" button={false} />
      <TableSkeleton cols={5} rows={8} twoLines={false} />
    </div>
  );
}
