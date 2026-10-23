import { PageTitle, TableSkeleton } from "@/components/skeletons";

/** The fallback for any page of the staff dashboard without a loading file of its own: a title and a table. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle />
      <TableSkeleton />
    </div>
  );
}
