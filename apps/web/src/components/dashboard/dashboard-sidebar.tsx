"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Logo, LogoMark } from "@/components/shared/logo";
import { visibleNavItems } from "./nav-config";

// Replaces the old hand-rolled dashboard-nav.tsx with shadcn's real
// Sidebar system (collapsible="icon" — collapses to icon-only rather than
// disappearing entirely, persists across reloads via the cookie
// SidebarProvider itself manages). Same nav items, same feature-gating
// logic as before, just re-rendered as SidebarMenuItems.
//
// Collapse/expand is SidebarRail below, not a button in the header row —
// it's a click/drag target already sitting right on the sidebar's outer
// edge (its own -right-4 positioning puts it on the boundary with the
// main content), so a second explicit toggle button would just duplicate
// it. The header simply swaps the full wordmark for the icon-only mark
// when collapsed, same spot either way.
export function DashboardSidebar({
  features = {},
}: {
  features?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const navItems = visibleNavItems(features);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-0">
        <Link href="/dashboard" aria-label="Dashboard home" className="flex items-center justify-center">
          <Logo isLink={false} className="h-[clamp(19px,1.3vw,22px)] group-data-[collapsible=icon]:hidden" />
          <LogoMark className="hidden h-[clamp(22px,1.5vw,25px)] w-[clamp(22px,1.5vw,25px)] group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link href={href}>
                        <Icon className="h-[clamp(15px,1vw,17px)] w-[clamp(15px,1vw,17px)]" />
                        <span className="text-[clamp(12.5px,0.85vw,13.5px)]">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
