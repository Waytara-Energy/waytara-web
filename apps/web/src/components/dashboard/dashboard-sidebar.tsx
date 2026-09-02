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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/logo";
import { visibleNavItems } from "./nav-config";

// Replaces the old hand-rolled dashboard-nav.tsx with shadcn's real
// Sidebar system (collapsible="icon" — collapses to icon-only rather than
// disappearing entirely, persists across reloads via the cookie
// SidebarProvider itself manages). Same nav items, same feature-gating
// logic as before, just re-rendered as SidebarMenuItems.
//
// The collapse toggle lives here in the sidebar's own header (logo left,
// toggle right — collapsing to just the toggle, centered, in icon-rail
// mode), not in the content header — the same place a collapsed-sidebar
// app like Claude's web UI keeps it, rather than a button floating in the
// main content area that has nothing to do with the content.
export function DashboardSidebar({
  features = {},
}: {
  features?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const navItems = visibleNavItems(features);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center justify-between border-b border-sidebar-border px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Link
          href="/dashboard"
          aria-label="Dashboard home"
          className="flex items-center group-data-[collapsible=icon]:hidden"
        >
          <Logo isLink={false} className="h-6" />
        </Link>
        <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
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
                        <Icon />
                        <span>{label}</span>
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
