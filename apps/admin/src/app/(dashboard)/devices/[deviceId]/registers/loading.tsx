import { BackLink, PageTitle, TableSkeleton } from "@/components/skeletons";

/** A device's registers: a back link, the title and the table of readings with its controls. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <BackLink />
        <PageTitle width="w-64" />
      </div>
      <TableSkeleton cols={6} rows={10} twoLines={false} />
    </div>
  );
}
