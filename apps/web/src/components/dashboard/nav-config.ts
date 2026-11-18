import {
  LayoutDashboard,
  Wrench,
  LifeBuoy,
  Settings,
  Activity,
  TrendingUp,
  FileDown,
  Cpu,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { TeamPage } from "@waytara/supabase/team";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only shown when `features[featureKey]` is true — Advance-tier pages. */
  featureKey?: string;
  /** The team page this belongs to: a team member only sees the items of the pages they were given (see @waytara/supabase/team). */
  pageKey?: TeamPage;
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
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, pageKey: "overview" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Activity, featureKey: "monitoring", pageKey: "monitoring" },
  // Analytics was previously its own sidebar entry/page — merged into
  // Performance's single page (its own features.analytics gate now checked
  // inline there, not as a second nav item/redirect-gated route).
  { href: "/dashboard/performance", label: "Performance", icon: TrendingUp, featureKey: "performance", pageKey: "performance" },
  { href: "/dashboard/reports", label: "Reports", icon: FileDown, featureKey: "reports", pageKey: "reports" },
  // A charger's sessions live on Monitoring (today), Performance and Reports (periods); the old Charging sessions menu entry is gone.
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench, pageKey: "maintenance" },
  // The site's map, kind and address: it was a tab of Devices. Not gated by the plan, like Devices itself.
  { href: "/dashboard/site", label: "Site", icon: MapPin, pageKey: "site" },
  { href: "/dashboard/devices", label: "Devices", icon: Cpu, pageKey: "devices" },
];

// Rendered by the avatar popup — still real pages with their own URLs, so
// the breadcrumb and command palette both still need to know about them
// (see ALL_NAV / allReachableNavItems below); they just don't get a
// sidebar row.
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Application Settings", icon: Settings },
];

export const ALL_NAV: NavItem[] = [...NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/** The menu's feature flags for the selected site: what the plan includes, plus the charging pages only while this site has an EV charger
 *  (a site without one shows none of them, whatever the plan says and whatever the customer's other sites have). */
export function navFeatures(
  planFeatures: Record<string, boolean> | undefined,
  devices: readonly { deviceType?: { category?: string | null } | null }[],
): Record<string, boolean> {
  return { ...(planFeatures ?? {}), ev_sessions: devices.some((d) => d.deviceType?.category === "ev_charger") };
}

/** Sidebar + command palette's primary list. `teamPages` is only given for a team member: they see just the pages they were given (an owner passes nothing). */
export function visibleNavItems(features: Record<string, boolean>, teamPages?: readonly string[] | null): NavItem[] {
  return NAV_ITEMS.filter((item) => (!item.featureKey || features[item.featureKey]) && (!teamPages || (item.pageKey !== undefined && teamPages.includes(item.pageKey))));
}

/** Command palette's full reach — primary items plus every account-menu
 *  page. A team member reaches their own Application Settings but not Support (which stays with the owner). */
export function allReachableNavItems(features: Record<string, boolean>, teamPages?: readonly string[] | null): NavItem[] {
  return [...visibleNavItems(features, teamPages), ...(teamPages ? SECONDARY_NAV_ITEMS.filter((i) => i.href === "/dashboard/settings") : SECONDARY_NAV_ITEMS)];
}
