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

// Single source of truth for dashboard navigation — the sidebar, the
// header breadcrumb, and the command palette (Phase 1) all read from this
// instead of keeping three separate lists in sync by hand.
export const BASE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/sites", label: "Sites & Devices", icon: Sun },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/billing", label: "Billing & Plan", icon: CreditCard },
  { href: "/dashboard/settings", label: "Application Settings", icon: Settings },
];

// Task 10: items gated by plans.features.
export const GATED_NAV: NavItem[] = [
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Activity, featureKey: "monitoring" },
  { href: "/dashboard/performance", label: "Performance", icon: TrendingUp, featureKey: "performance" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, featureKey: "analytics" },
  { href: "/dashboard/reports", label: "Reports", icon: FileDown, featureKey: "reports" },
  {
    href: "/dashboard/settings/instruments",
    label: "Instrument Settings",
    icon: SlidersHorizontal,
    featureKey: "instrument_settings",
  },
];

export function visibleNavItems(features: Record<string, boolean>): NavItem[] {
  return [...BASE_NAV, ...GATED_NAV.filter((item) => item.featureKey && features[item.featureKey])];
}
