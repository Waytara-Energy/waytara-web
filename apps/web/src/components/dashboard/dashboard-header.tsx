import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";
import { DashboardCommandMenu } from "./dashboard-command-menu";
import { DashboardUserMenu } from "./dashboard-user-menu";

// `1fr auto 1fr` centers the breadcrumb on the header's true midpoint
// regardless of how wide the right-hand cluster is. The sidebar collapse
// toggle itself now lives in the sidebar's own header (see
// dashboard-sidebar.tsx) instead of here — except on mobile, where the
// sidebar renders as a closed Sheet and that embedded toggle is
// unreachable until the Sheet is already open. The left slot keeps a
// `md:hidden` trigger just for that case; on desktop it's invisible and
// the empty slot is what balances the centering.
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
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="md:hidden" />
      <DashboardBreadcrumb />
      <div className="flex items-center justify-end gap-2">
        <DashboardCommandMenu features={features} />
        <ThemeToggle className="text-foreground hover:bg-accent hover:text-accent-foreground" />
        <DashboardUserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} planName={planName} planCode={planCode} />
      </div>
    </header>
  );
}
