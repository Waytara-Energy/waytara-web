"use client";

import * as React from "react";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { SolutionsView } from "@/components/sections/solutions-view";

export function SolutionsPageContent() {
  // Read after mount (not useSearchParams) so the page is server-rendered
  // instead of shipping only a Suspense fallback to crawlers.
  const [segmentParam, setSegmentParam] = React.useState("home");
  React.useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("segment");
    if (param) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSegmentParam(param);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1 pt-24 sm:pt-28">
        <div className="fluid-container">
          <SolutionsView initialSegment={segmentParam} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
