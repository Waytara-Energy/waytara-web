import { FilterPills, PageTitle, RowCards } from "@/components/skeletons";

/** The audit log: the title, two groups of filter pills (entities, actions) and the list of entries. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-40" />
      <FilterPills groups={[6, 4]} />
      <RowCards rows={10} />
    </div>
  );
}
