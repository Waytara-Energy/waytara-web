import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";
import { DashboardCommandMenu } from "./dashboard-command-menu";
import { DashboardUserMenu } from "./dashboard-user-menu";

// `minmax(0,1fr) auto minmax(0,1fr)` centers the breadcrumb on the
// header's true midpoint regardless of how wide the right-hand cluster is
// — a bare `1fr` track still gets an implicit content-based minimum
// width, so the (much wider) right cluster would out-grow the near-empty
// left one and drag the "centered" column off-center; `minmax(0, 1fr)`
// forces both flanking tracks to actually split the remaining space
// evenly. Each child also gets an explicit `col-start-*` — the mobile-only
// trigger below is `display:none` on desktop (`md:hidden`), and a
// `display:none` grid item is dropped from auto-placement entirely, which
// without explicit placement shifts the breadcrumb and right cluster one
// column to the left the moment that trigger disappears.
//
// The sidebar collapse toggle itself lives in the sidebar's own header
// (see dashboard-sidebar.tsx) instead of here — except on mobile, where
// the sidebar renders as a closed Sheet and that embedded toggle is
// unreachable until the Sheet is already open. The left slot's trigger is
// just for that case.
export function DashboardHeader({
  fullName,
  email,
  avatarUrl,
  planName,
  planCode,
  features,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName: string | null;
  planCode: string | null;
  features: Record<string, boolean>;
}) {
  return (
    <header className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="col-start-1 md:hidden" />
      <div className="col-start-2">
        <DashboardBreadcrumb />
      </div>
      <div className="col-start-3 flex items-center justify-end gap-2">
        <DashboardCommandMenu features={features} />
        <ThemeToggle className="text-foreground hover:bg-accent hover:text-accent-foreground" />
        <DashboardUserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} planName={planName} planCode={planCode} />
      </div>
    </header>
  );
}
