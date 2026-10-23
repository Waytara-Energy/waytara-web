import { FilterPills, PageTitle, RowCards } from "@/components/skeletons";

/** Device activity: the title, the filter pills (all sources and each source) and the list of entries. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-44" />
      <FilterPills groups={[7]} />
      <RowCards rows={8} />
    </div>
  );
}
