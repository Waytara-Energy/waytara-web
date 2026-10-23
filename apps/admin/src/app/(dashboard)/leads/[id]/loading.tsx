import { BackLink, DetailPanel, FormPanel, PageTitle } from "@/components/skeletons";

/** One lead: a back link, the name, then the submission, the assignment and the onboarding cards. */
export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <BackLink />
        <PageTitle width="w-56" />
      </div>
      <DetailPanel rows={6} />
      <FormPanel fields={2} grid="sm:grid-cols-2" />
      <DetailPanel rows={2} />
    </div>
  );
}
