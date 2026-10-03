import { redirect } from "next/navigation";

// Analytics is no longer its own sidebar item/page (see nav-config.ts) —
// its content merged into /dashboard/performance, gated inline there by
// the same features.analytics check this page used to redirect on.
// Kept as a redirect, not deleted, so old bookmarks/links still land
// somewhere real.
export default function AnalyticsPage() {
  redirect("/dashboard/performance");
}
