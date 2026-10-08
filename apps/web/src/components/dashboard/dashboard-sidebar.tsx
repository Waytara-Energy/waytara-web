"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/logo";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { cn } from "@/lib/utils";
import { DashboardCommandMenu } from "./dashboard-command-menu";
import { DashboardUserMenu } from "./dashboard-user-menu";
import { visibleNavItems } from "./nav-config";
import { useDeviceState } from "./use-device-state";

export interface SidebarDevice {
  id: string;
  name: string;
  sync: DeviceSyncInit;
}

export interface SidebarAccount {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName: string | null;
}

const DOT_CLASS = { online: "bg-emerald-500", connection_lost: "bg-amber-500", offline: "bg-red-500" } as const;
const DOT_TITLE = { online: "Online", connection_lost: "Connection lost", offline: "Offline" } as const;

/** A device's status as a small dot: green while it is reporting, amber when the unit cannot reach it, red when offline. */
function DeviceStatusDot({ deviceId, sync }: { deviceId: string; sync: DeviceSyncInit }) {
  const { status } = useDeviceState(deviceId, sync);
  return (
    <span
      role="img"
      aria-label={DOT_TITLE[status]}
      title={DOT_TITLE[status]}
      className={cn("ml-auto size-2 shrink-0 rounded-full", DOT_CLASS[status], status === "online" && "shadow-[0_0_6px_rgba(16,185,129,0.7)]")}
    />
  );
}

// The sidebar follows Claude desktop's: one continuous surface with the page (no border line), the brand mark as a round button
// that doubles as the collapse toggle (it stays at the top left when the sidebar slides away), search under it, the pages, the
// devices as a labelled list with a status dot each, and the account at the bottom.
export function DashboardSidebar({
  features = {},
  devices = [],
  account,
}: {
  features?: Record<string, boolean>;
  devices?: SidebarDevice[];
  account: SidebarAccount;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navItems = visibleNavItems(features).filter((i) => i.href !== "/dashboard/devices");
  const { isMobile, setOpenMobile } = useSidebar();
  const openDevice = searchParams.get("device");

  // On a phone the sidebar is a sheet over the page: picking something closes it.
  function handleNavClick() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="offcanvas" variant="overlay">
      {/* The full logo, with the collapse icon at the right end. The same height as the page header. */}
      <SidebarHeader className="h-[clamp(3.5rem,4.5vw,4.25rem)] flex-row items-center justify-between pl-4 pr-3">
        <Link href="/dashboard" aria-label="Dashboard home" onClick={handleNavClick} className="flex items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Logo isLink={false} />
        </Link>
        <SidebarTrigger aria-label={isMobile ? "Close menu" : "Close sidebar"} className="text-sidebar-foreground/70 hover:text-sidebar-foreground [&_svg]:size-[18px]" />
      </SidebarHeader>

      <SidebarContent className="gap-0 pb-2">
        <SidebarGroup className="pb-1 pt-0">
          <DashboardCommandMenu features={features} variant="sidebar" />
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname === href}>
                    <Link href={href} onClick={handleNavClick}>
                      <Icon className="h-[clamp(15px,1vw,17px)] w-[clamp(15px,1vw,17px)]" />
                      <span className="text-[clamp(12.5px,0.85vw,13.5px)]">{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel asChild>
            <Link href="/dashboard/devices" onClick={handleNavClick} className="hover:text-sidebar-foreground">
              Devices
            </Link>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {devices.length === 0 && <li className="px-2 py-1.5 text-xs text-sidebar-foreground/60">No devices yet</li>}
              {devices.map((d) => (
                <SidebarMenuItem key={d.id}>
                  <SidebarMenuButton asChild isActive={pathname === "/dashboard/devices" && openDevice === d.id}>
                    <Link href={`/dashboard/devices?device=${d.id}`} onClick={handleNavClick}>
                      <span className="truncate text-[clamp(12.5px,0.85vw,13.5px)]">{d.name}</span>
                      <DeviceStatusDot deviceId={d.id} sync={d.sync} />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative px-2 pb-3 pt-1">
        {/* The list fades out above the account row instead of being cut by a line. */}
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-sidebar to-transparent" />
        <DashboardUserMenu fullName={account.fullName} email={account.email} avatarUrl={account.avatarUrl} planName={account.planName} variant="sidebar" />
      </SidebarFooter>
    </Sidebar>
  );
}
