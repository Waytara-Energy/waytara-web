"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AdminAlerts } from "@/lib/admin-alerts";
import { visibleNavGroups } from "./admin-nav";
import { AdminCommandMenu } from "./admin-command-menu";
import { AdminNotificationCenter } from "./admin-notification-center";
import { AdminUserMenu, type AdminAccount } from "./admin-user-menu";

const LABEL = "text-[13px]";
const ICON = "size-4";

/**
 * The staff dashboard's sidebar, built like the customer dashboard's: the logo with the notification bell and the collapse icon, search under it, the
 * pages in groups (a badge at the end of a line says how many things in it need attention), and the account at the foot. It is open by default and
 * folds to a rail of icons (each with its name on hover, and a dot where something needs attention); on a phone it is a sheet. What you chose is
 * remembered.
 */
export function AdminSidebar({ role, alerts, account }: { role?: string | null; alerts: AdminAlerts; account: AdminAccount }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const groups = visibleNavGroups(role);

  // On a phone the sidebar is a sheet: picking a page closes it.
  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 flex-row items-center justify-between gap-2 pl-4 pr-2 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
        <Link href={role === "site_engineer" ? "/support" : "/dashboard"} onClick={handleNavClick} aria-label="WayTara Admin home" className="flex items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Image src="/images/logo.png" alt="WayTara" width={120} height={32} unoptimized priority className="h-7 w-auto object-contain group-data-[collapsible=icon]:hidden" />
          <Image src="/images/icon.png" alt="WayTara" width={24} height={24} unoptimized className="hidden size-6 object-contain group-data-[collapsible=icon]:block" />
        </Link>
        <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:flex-col">
          <AdminNotificationCenter alerts={alerts} />
          <SidebarTrigger aria-label={isMobile ? "Close menu" : "Hide sidebar"} className="text-sidebar-foreground/70 hover:text-sidebar-foreground [&_svg]:size-[18px]" />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 pb-2">
        <SidebarGroup className="pb-1 pt-0">
          <AdminCommandMenu groups={groups} />
        </SidebarGroup>

        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ label, href, icon: Icon, badge }) => {
                  const count = badge ? alerts.counts[badge] : 0;
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={pathname === href || pathname.startsWith(`${href}/`)} tooltip={count > 0 ? `${label} (${count})` : label}>
                        <Link href={href} onClick={handleNavClick}>
                          <Icon className={ICON} />
                          <span className={LABEL}>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count > 0 ? (
                        <>
                          <SidebarMenuBadge className={badge === "alerts" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-primary/15 text-primary"}>
                            {count > 99 ? "99+" : count}
                          </SidebarMenuBadge>
                          {/* on the folded rail the number is hidden: a dot says something needs attention */}
                          <span aria-hidden className={`pointer-events-none absolute right-1 top-1 hidden size-2 rounded-full group-data-[collapsible=icon]:block ${badge === "alerts" ? "bg-red-500" : "bg-primary"}`} />
                        </>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="relative px-2 pb-3 pt-1">
        {/* The list fades out above the account row instead of being cut by a line. */}
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-sidebar to-transparent" />
        <AdminUserMenu account={account} />
      </SidebarFooter>
    </Sidebar>
  );
}
