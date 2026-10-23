import { PageTitle, TableSkeleton } from "@/components/skeletons";

/** The stock catalog: the title with its two buttons, and the table of device models. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-52" withAction />
      <TableSkeleton cols={7} rows={8} />
    </div>
  );
}
