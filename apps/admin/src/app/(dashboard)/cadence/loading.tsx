import { FormPanel, PageTitle } from "@/components/skeletons";

/** Cadence data: the title and the download card (device, readings, period, download). */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-44" />
      <FormPanel title={false} fields={4} />
    </div>
  );
}
