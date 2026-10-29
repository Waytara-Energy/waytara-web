import { PageTitle, Panel, StatsSkeleton } from "@/components/skeletons";

/** Device keys: the title and a card for each device (its key, and the buttons to change it). */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-40" />
      <StatsSkeleton />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Panel key={i}>
            <div className="h-9" />
          </Panel>
        ))}
      </div>
    </div>
  );
}
