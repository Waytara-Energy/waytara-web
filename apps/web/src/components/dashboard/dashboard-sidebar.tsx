"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/logo";
import { visibleNavItems } from "./nav-config";

// Replaces the old hand-rolled dashboard-nav.tsx with shadcn's real
// Sidebar system (collapsible="icon" — collapses to icon-only rather than
// disappearing entirely, persists across reloads via the cookie
// SidebarProvider itself manages). Same nav items, same feature-gating
// logic as before, just re-rendered as SidebarMenuItems.
export function DashboardSidebar({
  planName,
  features = {},
}: {
  planName?: string | null;
  features?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const navItems = visibleNavItems(features);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-0">
        <Link href="/dashboard" aria-label="Dashboard home" className="flex items-center justify-center">
          <Logo isLink={false} className="h-6 group-data-[collapsible=icon]:hidden" />
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

      <SidebarFooter className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
        Plan: <span className="font-medium text-sidebar-foreground">{planName ?? "None yet"}</span>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
