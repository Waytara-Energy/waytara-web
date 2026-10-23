import { FormPanel, PageTitle, Panel } from "@/components/skeletons";

/** Service plans: the title, the card to add a plan, the plans, and the card to attach a plan to a device. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-44" />
      <FormPanel fields={4} />
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <Panel key={i}>
            <div className="h-24" />
          </Panel>
        ))}
      </div>
      <FormPanel fields={3} grid="sm:grid-cols-3" />
    </div>
  );
}
