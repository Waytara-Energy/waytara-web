import { BackLink, DetailPanel, FormPanel, PageTitle } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** One onboarding: a back link, the name, the stages, then the cards for the quotation, payment, installation and devices. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <BackLink />
        <PageTitle width="w-64" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DetailPanel rows={6} />
        <DetailPanel rows={6} />
      </div>
      <FormPanel fields={3} grid="sm:grid-cols-3" />
    </div>
  );
}
