"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home, LifeBuoy, LogOut, Waypoints } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { logout } from "@/app/dashboard/actions";
import { useLiveProfile } from "@/components/profile-live";
import { cn } from "@/lib/utils";
import { FlowLegend } from "./flow-legend";

function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

const LABEL = "text-[clamp(12.5px,0.85vw,13.5px)]";
const ICON = "h-[clamp(15px,1vw,17px)] w-[clamp(15px,1vw,17px)]";

/** The foot of the sidebar: (on the Overview) the energy flow's colour key, then Support, Home and Sign out as rows like the pages above them, and under them the account banner (picture, name,
 *  plan), which opens Application Settings. Nothing unfolds or pops up. */
export function DashboardUserMenu({
  fullName: savedName,
  email,
  avatarUrl: savedAvatar,
  planName,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName?: string | null;
}) {
  const { isMobile, setOpenMobile, setOpen: setSidebarOpen, open: sidebarOpen, openMobile } = useSidebar();
  const pathname = usePathname();
  // a picture or name saved a moment ago shows at once (the server renders this from what it read before the save)
  const { fullName, avatarUrl } = useLiveProfile({ fullName: savedName, avatarUrl: savedAvatar });

  // logout() redirects on completion, so this only shows the sign-out as busy until the page leaves.
  const [loggingOut, startLogoutTransition] = React.useTransition();
  function handleLogout() {
    startLogoutTransition(() => {
      void logout();
    });
  }

  // Going to a page folds the sidebar away (a sheet on a phone).
  function handleNavigate() {
    if (isMobile) setOpenMobile(false);
    else setSidebarOpen(false);
  }

  const inSettings = pathname.startsWith("/dashboard/settings");

  // The energy flow's colour key, above Support, on the Overview (the page that has the drawing). It unfolds in place; when the sidebar closes
  // it folds again, so it is closed the next time the sidebar opens.
  const onOverview = pathname === "/dashboard";
  const [legendOpen, setLegendOpen] = React.useState(false);
  const sidebarShown = isMobile ? openMobile : sidebarOpen;
  const [wasShown, setWasShown] = React.useState(sidebarShown);
  if (wasShown !== sidebarShown) {
    setWasShown(sidebarShown);
    if (!sidebarShown) setLegendOpen(false);
  }

  return (
    <div className="space-y-1">
      <SidebarMenu>
        {onOverview && (
          <SidebarMenuItem>
            <Collapsible open={legendOpen} onOpenChange={setLegendOpen}>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <Waypoints className={ICON} />
                  <span className={LABEL}>Energy flow colours</span>
                  <ChevronRight className={cn("ml-auto size-4 shrink-0 text-sidebar-foreground/60 transition-transform", legendOpen && "rotate-90")} />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-2 pb-2 pt-2">
                  <FlowLegend />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </SidebarMenuItem>
        )}
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/support")}>
            <Link href="/dashboard/support" onClick={handleNavigate}>
              <LifeBuoy className={ICON} />
              <span className={LABEL}>Support</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/" onClick={handleNavigate}>
              <Home className={ICON} />
              <span className={LABEL}>Home</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton disabled={loggingOut} onClick={handleLogout} className="text-red-500 hover:text-red-500 active:text-red-500 [&>svg]:text-red-500">
            {loggingOut ? <Spinner /> : <LogOut className={ICON} />}
            <span className={LABEL}>{loggingOut ? "Signing out…" : "Sign out"}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <Link
        href="/dashboard/settings"
        onClick={handleNavigate}
        aria-label="Application Settings"
        aria-current={inSettings ? "page" : undefined}
        className={cn("flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring", inSettings && "bg-sidebar-accent")}
      >
        <Avatar className="h-8 w-8 shrink-0 border-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Account"} />}
          <AvatarFallback className="text-xs">{initials(fullName, email)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight text-sidebar-foreground">{fullName ?? "Your account"}</span>
          <span className="block truncate text-xs leading-tight text-sidebar-foreground/60">{planName ?? email}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-sidebar-foreground/60" />
      </Link>
    </div>
  );
}
