import { Activity, Bell, LayoutDashboard, ClipboardCheck, Cpu, KeyRound, Layers, LifeBuoy, ScrollText, UserCheck, UserCircle2, Users, UsersRound, Wrench, Zap, History, type LucideIcon } from "lucide-react";

/** Which count in AdminAlerts a nav line wears as its badge. */
export type NavBadge = "leads" | "support" | "alerts";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: NavBadge;
  /** only admins reach it (the proxy enforces the same list) */
  adminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The overview, shown on its own under the search (not in a group). */
export const OVERVIEW_ITEM: NavItem = { label: "Overview", href: "/dashboard", icon: LayoutDashboard };

/** The staff dashboard's pages, in the groups the sidebar shows. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Work",
    items: [
      { label: "Leads", href: "/leads", icon: Users, badge: "leads" },
      { label: "Onboarding", href: "/onboarding", icon: ClipboardCheck },
      { label: "Support", href: "/support", icon: LifeBuoy, badge: "support" },
      { label: "Customers", href: "/customers", icon: UserCircle2, adminOnly: true },
    ],
  },
  {
    label: "Fleet",
    items: [
      { label: "Alerts", href: "/alerts", icon: Bell, badge: "alerts" },
      { label: "Stock", href: "/devices", icon: Cpu, adminOnly: true },
      { label: "Cadence data", href: "/cadence", icon: Activity },
      { label: "Device keys", href: "/keys", icon: KeyRound },
      { label: "Device activity", href: "/activity", icon: History },
    ],
  },
  {
    label: "Plans and pricing",
    items: [
      { label: "Plans", href: "/plans", icon: Layers, adminOnly: true },
      { label: "Service plans", href: "/service-plans", icon: Wrench, adminOnly: true },
      { label: "Electricity rates", href: "/tariffs", icon: Zap, adminOnly: true },
    ],
  },
  {
    label: "Team and access",
    items: [
      { label: "Employees", href: "/employees", icon: UsersRound, adminOnly: true },
      { label: "Site access", href: "/site-access", icon: UserCheck, adminOnly: true },
      { label: "Audit log", href: "/audit", icon: ScrollText, adminOnly: true },
    ],
  },
];

/** What a role sees: a site engineer works the support desk only, an employee does not see the admin-only pages. */
export function visibleNavGroups(role: string | null | undefined): NavGroup[] {
  const allow = (i: NavItem) => (role === "site_engineer" ? i.href === "/support" : role === "admin" || !i.adminOnly);
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(allow) })).filter((g) => g.items.length > 0);
}
