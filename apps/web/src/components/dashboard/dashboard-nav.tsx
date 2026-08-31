"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sun,
  Wrench,
  CreditCard,
  Settings,
  Activity,
  TrendingUp,
  BarChart3,
  FileDown,
  SlidersHorizontal,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const BASE_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/sites", label: "Sites & Devices", icon: Sun },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/billing", label: "Billing & Plan", icon: CreditCard },
  { href: "/dashboard/settings", label: "Application Settings", icon: Settings },
] as const;

// Task 10: items gated by plans.features.
const GATED_NAV = [
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
] as const;

export function DashboardNav({
  planName,
  features = {},
}: {
  planName?: string | null;
  features?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const navItems = [
    ...BASE_NAV,
    ...GATED_NAV.filter((item) => features[item.featureKey]),
  ];

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-theme-border bg-theme-surface">
      <div className="flex h-16 items-center border-b border-theme-border px-5">
        <Link href="/dashboard" aria-label="Dashboard home">
          <Logo isLink={false} className="h-6" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-theme-surface-hover text-theme-highlight"
                  : "text-theme-secondary hover:bg-theme-surface-hover hover:text-theme-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-theme-border p-3 text-xs text-theme-muted">
        Plan: <span className="font-medium text-theme-primary">{planName ?? "None yet"}</span>
      </div>
    </aside>
  );
}
