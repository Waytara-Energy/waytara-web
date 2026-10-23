"use client";

import type { ComponentProps } from "react";
import { Bell, BellRing, CreditCard, Gauge, LayoutDashboard, LockKeyhole, Palette, Ruler, ShieldCheck, User, type LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SettingsTab } from "@/lib/account-health";
import { cn } from "@/lib/utils";
import { useHashTab } from "../use-hash-tab";
import { AccountSection, type AccountProps } from "./account-section";
import { AlertsSection, type AlertsProps } from "./alerts-section";
import { AppearanceSection } from "./appearance-section";
import { BillingSection, type BillingProps } from "./billing-section";
import { DashboardSection, type DashboardProps } from "./dashboard-section";
import { NotificationsSection } from "./notifications-section";
import { PrivacySection } from "./privacy-section";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";
import { SettingsHero, type HeroProps } from "./settings-hero";
import { SettingsNavProvider } from "./settings-nav";
import { UnitsSection } from "./units-section";

// Each tab has its own colour, the way the tabs of Monitoring, Performance and Maintenance do: the line under the open tab.
const TABS: { id: SettingsTab; label: string; icon: LucideIcon; active: string }[] = [
  { id: "account", label: "Account", icon: Gauge, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400" },
  { id: "profile", label: "Profile", icon: User, active: "data-[state=active]:border-teal-500 data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-400" },
  { id: "appearance", label: "Appearance", icon: Palette, active: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400" },
  { id: "units", label: "Units", icon: Ruler, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400" },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, active: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400" },
  { id: "notifications", label: "Notifications", icon: Bell, active: "data-[state=active]:border-rose-500 data-[state=active]:text-rose-600 dark:data-[state=active]:text-rose-400" },
  { id: "alerts", label: "Alerts", icon: BellRing, active: "data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400" },
  { id: "billing", label: "Billing", icon: CreditCard, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400" },
  { id: "security", label: "Security", icon: ShieldCheck, active: "data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400" },
  { id: "privacy", label: "Privacy & data", icon: LockKeyhole, active: "data-[state=active]:border-slate-500 data-[state=active]:text-slate-700 dark:data-[state=active]:text-slate-300" },
];
const IDS = TABS.map((t) => t.id);

export interface SettingsBoardProps {
  hero: HeroProps;
  account: AccountProps;
  profile: ComponentProps<typeof ProfileSection>;
  appearance: ComponentProps<typeof AppearanceSection>;
  units: ComponentProps<typeof UnitsSection>;
  dashboard: DashboardProps;
  notifications: ComponentProps<typeof NotificationsSection>;
  alerts: AlertsProps;
  billing: BillingProps;
  security: ComponentProps<typeof SecuritySection>;
  privacy: ComponentProps<typeof PrivacySection>;
}

/** Application Settings: a hero (who this is), a row of ten tabs, and the open tab's cards at the full width of the page. A tab can carry a small
 *  sign: a dot where something is worth doing (an incomplete profile, two-factor sign-in not set up, notifications paused), or a count. The open tab
 *  is kept in the address (#security) so a reload or a shared link opens the same one. */
export function SettingsBoard(props: SettingsBoardProps) {
  const [tab, open] = useHashTab(IDS, "account");
  const { account, alerts } = props;

  const signs: Partial<Record<SettingsTab, { dot?: "amber" | "rose"; count?: number }>> = {
    profile: props.hero.completeness < 100 ? { dot: "amber" } : undefined,
    security: account.health.twoFactor ? undefined : { dot: "amber" },
    notifications: account.pausedUntil ? { dot: "amber" } : undefined,
    billing: props.billing.summary.pending > 0 ? { dot: "amber" } : undefined,
    alerts: { count: alerts.rules.filter((r) => r.enabled).length },
  };

  return (
    <SettingsNavProvider value={{ go: open }}>
      <div className="space-y-5">
        <SettingsHero {...props.hero} />

        <Tabs value={tab} onValueChange={(v) => open(v as SettingsTab)}>
          <TabsList variant="line" className="w-full flex-nowrap justify-start overflow-x-auto">
            {TABS.map((t) => {
              const sign = signs[t.id];
              return (
                <TabsTrigger key={t.id} value={t.id} variant="line" className={t.active}>
                  <t.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
                  <span className="text-sm font-medium">{t.label}</span>
                  {sign?.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{sign.count}</span>}
                  {sign?.dot && <span className={cn("size-1.5 rounded-full", sign.dot === "rose" ? "bg-rose-500" : "bg-amber-500")} aria-label="worth a look" />}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div key={tab} className="min-w-0">
          {tab === "account" && <AccountSection {...account} />}
          {tab === "profile" && <ProfileSection {...props.profile} />}
          {tab === "appearance" && <AppearanceSection {...props.appearance} />}
          {tab === "units" && <UnitsSection {...props.units} />}
          {tab === "dashboard" && <DashboardSection {...props.dashboard} />}
          {tab === "notifications" && <NotificationsSection {...props.notifications} />}
          {tab === "alerts" && <AlertsSection {...props.alerts} />}
          {tab === "billing" && <BillingSection {...props.billing} />}
          {tab === "security" && <SecuritySection {...props.security} />}
          {tab === "privacy" && <PrivacySection {...props.privacy} />}
        </div>
      </div>
    </SettingsNavProvider>
  );
}

