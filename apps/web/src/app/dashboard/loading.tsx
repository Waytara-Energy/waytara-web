import { SkeletonCard, SkeletonChart, SkeletonHeadline, SkeletonLineTabs, SkeletonStatGrid } from "@/components/dashboard/skeletons";

/** The fallback for any dashboard page that has no loading file of its own: the shape most pages share (a headline, tabs, a row of figures and a
 *  chart). Every page of the dashboard has its own, so this is only seen for a page added later. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonHeadline trailing="pill" />
      <SkeletonLineTabs count={4} />
      <SkeletonStatGrid cols={4} />
      <SkeletonCard>
        <SkeletonChart />
      </SkeletonCard>
    </div>
  );
}
