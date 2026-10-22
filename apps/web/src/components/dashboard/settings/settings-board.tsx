"use client";

import type { ComponentProps } from "react";
import { Bell, LayoutDashboard, MapPin, Palette, Ruler, ShieldCheck, User, type LucideIcon } from "lucide-react";
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

const SECTIONS: { id: SectionId; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", hint: "Photo, name, phone, e-mail", icon: User },
  { id: "appearance", label: "Appearance", hint: "Theme and charts", icon: Palette },
  { id: "units", label: "Units", hint: "kW or W, kWh or MJ, °C or °F", icon: Ruler },
  { id: "overview", label: "Overview", hint: "Cards and background", icon: LayoutDashboard },
  { id: "notifications", label: "Notifications", hint: "What we e-mail you", icon: Bell },
  { id: "addresses", label: "Addresses & billing", hint: "Address, billing details", icon: MapPin },
  { id: "security", label: "Account & security", hint: "Password, sessions, devices", icon: ShieldCheck },
];
const IDS = SECTIONS.map((s) => s.id);

export interface SettingsBoardProps {
  profile: ComponentProps<typeof ProfileSection>;
  notifications: ComponentProps<typeof NotificationsSection>;
  addresses: ComponentProps<typeof AddressesSection>;
  overview: ComponentProps<typeof OverviewSection>;
  units: ComponentProps<typeof UnitsSection>;
  security: ComponentProps<typeof SecuritySection>;
}

/** Application Settings: a list of sections on the left (a row of tabs on a phone) and the open one on the right. The open section is kept in
 *  the address (#security) so a reload or a shared link opens the same one. */
export function SettingsBoard({ profile, notifications, addresses, overview, units, security }: SettingsBoardProps) {
  const [section, open] = useHashTab(IDS, "profile");
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {SECTIONS.map((s) => {
          const on = s.id === section;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => open(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                on ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", on ? "bg-primary/15 text-primary" : "bg-muted")}>
                <s.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-medium">{s.label}</span>
                <span className="hidden truncate text-xs text-muted-foreground lg:block">{s.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div key={current.id} className="min-w-0 max-w-3xl">
        {section === "profile" && <ProfileSection {...profile} />}
        {section === "appearance" && (
          <div className="space-y-5">
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
