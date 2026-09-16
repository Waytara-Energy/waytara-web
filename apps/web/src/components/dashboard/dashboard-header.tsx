import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";
import { DashboardCommandMenu } from "./dashboard-command-menu";
import { DashboardUserMenu } from "./dashboard-user-menu";
import { SiteSwitcher, type SwitcherSite } from "./site-switcher";

// `minmax(0,1fr) auto minmax(0,1fr)` centers the breadcrumb on the
// header's true midpoint regardless of how wide the flanking clusters are
// — a bare `1fr` track still gets an implicit content-based minimum
// width, so an unequal pair would out-grow one another and drag the
// "centered" column off-center; `minmax(0, 1fr)` forces both flanking
// tracks to actually split the remaining space evenly. The breadcrumb and
// both clusters get an explicit `col-start-*` for the same reason
// auto-placement can't be trusted here.
export function DashboardHeader({
  fullName,
  email,
  avatarUrl,
  planName,
  features,
  sites,
  selectedSiteId,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName: string | null;
  features: Record<string, boolean>;
  sites: SwitcherSite[];
  selectedSiteId: string | null;
}) {
  return (
    <header className="grid h-[clamp(3.5rem,4.5vw,4.25rem)] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 bg-background px-4">
      <div className="col-start-1 flex min-w-0 items-center gap-2">
        {/* The sidebar's own toggle lives in its logo row, but on mobile
            that sidebar is an off-canvas Sheet that starts closed — with no
            trigger reachable outside it, there was no way to open it at
            all. This is the only way in on mobile — hidden at md+ since
            desktop already has its own toggle in the sidebar itself. */}
        <SidebarTrigger className="md:hidden [&_svg]:h-[clamp(17px,1.15vw,19.5px)] [&_svg]:w-[clamp(17px,1.15vw,19.5px)]" />
        <SiteSwitcher sites={sites} selectedId={selectedSiteId} />
      </div>
      <div className="col-start-2 min-w-0">
        <DashboardBreadcrumb />
      </div>
      <div className="col-start-3 flex items-center justify-end gap-2">
        <DashboardCommandMenu features={features} />
        <DashboardUserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} planName={planName} />
      </div>
    </header>
  );
}
