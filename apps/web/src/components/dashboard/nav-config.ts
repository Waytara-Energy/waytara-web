import {
  LayoutDashboard,
  Sun,
  Wrench,
  LifeBuoy,
  CreditCard,
  Settings,
  Activity,
  TrendingUp,
  BarChart3,
  FileDown,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only shown when `features[featureKey]` is true — Advance-tier pages. */
  featureKey?: string;
}

// Single source of truth for dashboard navigation. One ordered list (not a
// base/gated split concatenated together) because the sidebar's required
// order interleaves gated and ungated items — Maintenance sits after
// Reports, not grouped with the other always-on pages — so a filter that
// preserves order beats a concat that can't express that ordering.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Activity, featureKey: "monitoring" },
  { href: "/dashboard/performance", label: "Performance", icon: TrendingUp, featureKey: "performance" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, featureKey: "analytics" },
  { href: "/dashboard/reports", label: "Reports", icon: FileDown, featureKey: "reports" },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  {
    href: "/dashboard/settings/instruments",
    label: "Instrument Settings",
    icon: SlidersHorizontal,
    featureKey: "instrument_settings",
  },
];

// Moved out of the sidebar and into the account (avatar) menu — still real
// pages with their own URLs, so the breadcrumb and command palette both
// still need to know about them; they just don't get a sidebar row.
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/sites", label: "Sites & Devices", icon: Sun },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/billing", label: "Billing & Plan", icon: CreditCard },
  { href: "/dashboard/settings", label: "Application Settings", icon: Settings },
];

export const ALL_NAV: NavItem[] = [...NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/** Sidebar + command palette's primary list. */
export function visibleNavItems(features: Record<string, boolean>): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.featureKey || features[item.featureKey]);
}

/** Command palette's full reach — primary items plus the account-menu
 *  pages, none of which are feature-gated, so nothing extra to filter. */
export function allReachableNavItems(features: Record<string, boolean>): NavItem[] {
  return [...visibleNavItems(features), ...SECONDARY_NAV_ITEMS];
}
