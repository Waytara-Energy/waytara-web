import { Panel, PageTitle } from "@/components/skeletons";

/** The dashboard's first page: the title and a note card. */
export default function Loading() {
  return (
    <div className="max-w-2xl space-y-4" aria-busy="true" aria-label="Loading">
      <PageTitle width="w-40" />
      <Panel title={false}>
        <div className="h-10" />
      </Panel>
    </div>
  );
}
