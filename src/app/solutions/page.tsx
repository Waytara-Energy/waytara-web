"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { SolutionsView } from "@/components/sections/solutions-view";

function SolutionsPageContent() {
  const searchParams = useSearchParams();
  const segmentParam = searchParams.get("segment") || "home";

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

export default function SolutionsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
          <Navigation />
          <main className="flex-1 pt-28 pb-20 fluid-container">
            <div className="h-64 rounded-3xl bg-theme-surface/50 animate-pulse border border-theme-border flex items-center justify-center text-sm text-theme-muted">
              Loading Solutions Knowledge Hub...
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <SolutionsPageContent />
    </React.Suspense>
  );
}
