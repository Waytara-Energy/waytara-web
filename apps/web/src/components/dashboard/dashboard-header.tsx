import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";
import { DashboardCommandMenu } from "./dashboard-command-menu";
import { DashboardUserMenu } from "./dashboard-user-menu";

export function DashboardHeader({
  fullName,
  email,
  avatarUrl,
  features,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  features: Record<string, boolean>;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <DashboardBreadcrumb />
      </div>
      <div className="flex items-center gap-2">
        <DashboardCommandMenu features={features} />
        <ThemeToggle className="text-foreground hover:bg-accent hover:text-accent-foreground" />
        <DashboardUserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
