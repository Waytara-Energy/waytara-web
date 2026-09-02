import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";
import { DashboardCommandMenu } from "./dashboard-command-menu";
import { DashboardUserMenu } from "./dashboard-user-menu";
import { DeviceSwitcher, type SwitcherDevice } from "./device-switcher";

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
  devices,
  selectedDeviceId,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName: string | null;
  features: Record<string, boolean>;
  devices: SwitcherDevice[];
  selectedDeviceId: string | null;
}) {
  return (
    <header className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-border px-4">
      <div className="col-start-1 flex min-w-0 items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5 shrink-0" />
        <DeviceSwitcher devices={devices} selectedId={selectedDeviceId} />
      </div>
      <div className="col-start-2 min-w-0">
        <DashboardBreadcrumb />
      </div>
      <div className="col-start-3 flex items-center justify-end gap-2">
        <DashboardCommandMenu features={features} />
        <ThemeToggle className="text-foreground hover:bg-accent hover:text-accent-foreground" />
        <DashboardUserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} planName={planName} />
      </div>
    </header>
  );
}
