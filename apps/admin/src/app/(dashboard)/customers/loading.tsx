import { PageTitle, TableSkeleton } from "@/components/skeletons";

/** Customers: the title and the table of accounts (name, plan, status, subscription, joined). */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-36" />
      <TableSkeleton cols={6} rows={8} />
    </div>
  );
}
