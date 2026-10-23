import { BackLink, PageTitle, TableSkeleton } from "@/components/skeletons";

/** The equipment enum: a back link, the title and the table of values. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <BackLink />
        <PageTitle width="w-48" />
      </div>
      <TableSkeleton cols={4} rows={8} twoLines={false} />
    </div>
  );
}
