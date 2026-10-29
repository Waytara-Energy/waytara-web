import { FormPanel, PageTitle, Panel, StatsSkeleton } from "@/components/skeletons";

/** Site access: the title, the search row and a card for each site with the people who can open it. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-36" />
      <StatsSkeleton />
      <FormPanel title={false} fields={1} grid="sm:grid-cols-3" button={false} />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Panel key={i}>
            <div className="h-24" />
          </Panel>
        ))}
      </div>
    </div>
  );
}
