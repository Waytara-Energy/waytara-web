"use client";

import type { ComponentProps } from "react";
import { Bell, LayoutDashboard, MapPin, Palette, Ruler, ShieldCheck, User, type LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AppearanceSetting } from "../appearance-setting";
import { ChartStyleSetting } from "../chart-style-setting";
import { useHashTab } from "../use-hash-tab";
import { AddressesSection } from "./addresses-section";
import { NotificationsSection } from "./notifications-section";
import { OverviewSection } from "./overview-section";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";
import { UnitsSection } from "./units-section";

type SectionId = "profile" | "appearance" | "units" | "overview" | "notifications" | "addresses" | "security";

// Each tab has its own colour, the way the tabs of Monitoring, Performance and Maintenance do: the round icon of the headline and the line under
// the open tab.
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; active: string; circle: string }[] = [
  { id: "profile", label: "Profile", icon: User, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400", circle: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { id: "appearance", label: "Appearance", icon: Palette, active: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400", circle: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { id: "units", label: "Units", icon: Ruler, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400", circle: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { id: "overview", label: "Overview", icon: LayoutDashboard, active: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400", circle: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { id: "notifications", label: "Notifications", icon: Bell, active: "data-[state=active]:border-rose-500 data-[state=active]:text-rose-600 dark:data-[state=active]:text-rose-400", circle: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  { id: "addresses", label: "Addresses & billing", icon: MapPin, active: "data-[state=active]:border-teal-500 data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-400", circle: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  { id: "security", label: "Account & security", icon: ShieldCheck, active: "data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400", circle: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
];
const IDS = SECTIONS.map((s) => s.id);

// What each tab says in the headline besides its name.
const ABOUT: Record<SectionId, string> = {
  profile: "Photo, name, phone and e-mail",
  appearance: "Theme and charts",
  units: "kW or W, kWh or MJ, °C or °F",
  overview: "Cards and background",
  notifications: "What we e-mail you, and your alerts",
  addresses: "Address and billing details",
  security: "Password, sessions and devices",
};

export interface SettingsBoardProps {
  /** shown in the headline: who is signed in, and on how many devices */
  who: { name: string; devices: number };
  profile: ComponentProps<typeof ProfileSection>;
  notifications: ComponentProps<typeof NotificationsSection>;
  addresses: ComponentProps<typeof AddressesSection>;
  overview: ComponentProps<typeof OverviewSection>;
  units: ComponentProps<typeof UnitsSection>;
  security: ComponentProps<typeof SecuritySection>;
}

/** Application Settings, built like Performance, Maintenance and Billing: a headline for the open tab, a row of tabs, and the tab's cards at the
 *  full width of the page. The open tab is kept in the address (#security) so a reload or a shared link opens the same one. */
export function SettingsBoard({ who, profile, notifications, addresses, overview, units, security }: SettingsBoardProps) {
  const [section, open] = useHashTab(IDS, "profile");
  const meta = SECTIONS.find((s) => s.id === section)!;
  const Icon = meta.icon;

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", meta.circle)}>
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">Application Settings · {ABOUT[section]}</p>
          <p className="truncate text-3xl font-semibold leading-tight tracking-tight text-theme-primary sm:text-4xl">{meta.label}</p>
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          <div>
            <p className="text-sm font-medium text-theme-muted">Signed in as</p>
            <p className="text-2xl font-semibold tracking-tight text-theme-primary">{who.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-theme-muted">Devices signed in</p>
            <p className="text-2xl font-semibold tracking-tight text-theme-primary">{who.devices}</p>
          </div>
        </div>
      </div>

      <Tabs value={section} onValueChange={(v) => open(v as SectionId)}>
        <TabsList variant="line">
          {SECTIONS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} variant="line" className={t.active}>
              <t.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
              <span className="text-sm font-medium">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div key={section} className="min-w-0">
        {section === "profile" && <ProfileSection {...profile} />}
        {section === "appearance" && (
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <AppearanceSetting />
            <ChartStyleSetting />
          </div>
        )}
        {section === "units" && <UnitsSection {...units} />}
        {section === "overview" && <OverviewSection {...overview} />}
        {section === "notifications" && <NotificationsSection {...notifications} />}
        {section === "addresses" && <AddressesSection {...addresses} />}
        {section === "security" && <SecuritySection {...security} />}
      </div>
    </div>
  );
}
