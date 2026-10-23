import { PageTitle, PlanCardSkeleton } from "@/components/skeletons";

/** Plans: the title and the three plan cards. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-28" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <PlanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
