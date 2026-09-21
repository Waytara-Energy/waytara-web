import {
  LayoutDashboard,
  Wrench,
  LifeBuoy,
  CreditCard,
  Settings,
  Activity,
  TrendingUp,
  BarChart3,
  FileDown,
  Cpu,
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
// order interleaves gated and ungated items — Maintenance and Devices both
// sit after Reports, not grouped with the other always-on pages — so a
// filter that preserves order beats a concat that can't express that
// ordering.
//
// Devices is the consolidated hub for device+site details and settings by
// category (was three separate destinations: Devices, Sites & Devices,
// Instrument Settings) — not feature-gated itself, since Device/Site
// Details are always visible; the settings-editing section within it still
// checks `features.instrument_settings` on the page itself.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Activity, featureKey: "monitoring" },
  { href: "/dashboard/performance", label: "Performance", icon: TrendingUp, featureKey: "performance" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, featureKey: "analytics" },
  { href: "/dashboard/reports", label: "Reports", icon: FileDown, featureKey: "reports" },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/devices", label: "Devices", icon: Cpu },
];

// Rendered by the avatar popup — still real pages with their own URLs, so
// the breadcrumb and command palette both still need to know about them
// (see ALL_NAV / allReachableNavItems below); they just don't get a
// sidebar row.
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/billing", label: "Billing & Plan", icon: CreditCard },
  { href: "/dashboard/settings", label: "Application Settings", icon: Settings },
];

export const ALL_NAV: NavItem[] = [...NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/** Sidebar + command palette's primary list. */
export function visibleNavItems(features: Record<string, boolean>): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.featureKey || features[item.featureKey]);
}

/** Command palette's full reach — primary items plus every account-menu
 *  page — none of which are feature-gated, so nothing extra to filter. */
export function allReachableNavItems(features: Record<string, boolean>): NavItem[] {
  return [...visibleNavItems(features), ...SECONDARY_NAV_ITEMS];
}
