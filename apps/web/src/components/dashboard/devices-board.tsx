"use client";

import * as React from "react";
import { BatteryCharging, CalendarClock, Info, MapPin, Plug, SlidersHorizontal, Wrench, Zap, type LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agoText } from "@/lib/device-status-summary";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import type { ConfigLogRow, EnumOption, SettingField } from "@/lib/instrument-catalog-data";
import { AREA_LABEL, AREA_ORDER, type SettingArea } from "@/lib/setting-values";
import { cn } from "@/lib/utils";
import { TONE_CIRCLE, type CardTone } from "./device-card";
import { SettingsPane, SettingsProvider, useNeedsAttention, useSettingsSummary } from "./device-settings";
import { useDeviceState } from "./use-device-state";
import { useHashTab } from "./use-hash-tab";

export interface HeadlineData {
  label: string;
  value: string;
  figures: { label: string; value: string }[];
}

// The accent of a tab (underline and label when open), the same colours the Monitoring, Performance and Maintenance tabs use.
const TAB_ACCENT: Record<CardTone, string> = {
  neutral: "data-[state=active]:border-primary data-[state=active]:text-primary",
  primary: "data-[state=active]:border-primary data-[state=active]:text-primary",
  amber: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400",
  emerald: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400",
  sky: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400",
  violet: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400",
};

const AREA_META: Record<SettingArea, { icon: LucideIcon; description: string }> = {
  basic: { icon: SlidersHorizontal, description: "Sound and screen on the inverter." },
  battery: { icon: BatteryCharging, description: "When the battery charges, and the level it keeps in reserve." },
  work_mode: { icon: CalendarClock, description: "Whether to sell solar, what comes first, the grid limit and the daily schedule." },
  grid: { icon: Zap, description: "How the inverter connects to the grid." },
  advanced: { icon: Wrench, description: "Extra functions of the inverter." },
  gen_port: { icon: Plug, description: "What the generator port feeds, and when it switches on and off." },
  account: { icon: SlidersHorizontal, description: "" },
};

/** One tab of the page. */
interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: CardTone;
  /** What the tab shows: a page of details, the site, or a page of settings (with the fields it holds). */
  kind: "details" | "site" | "settings";
  fields: SettingField[];
  description?: string;
  node?: React.ReactNode;
  headline?: HeadlineData;
  /** The tab of the device itself (its headline also shows whether it is online). */
  isDevice?: boolean;
}

const STATE_TEXT = { online: "Online", connection_lost: "Connection lost", offline: "Offline" } as const;

/** The Devices page, built like Performance and Maintenance: a headline for the open tab, a row of tabs (the device, each part installed
 *  with it, the site, then the pages of the inverter's own settings menu) and cards under them. Settings follow the inverter live; the
 *  details and the site are rendered by the server. */
export function DevicesBoard({
  deviceId,
  sync,
  fields,
  enumOptions,
  log,
  mode,
  devicePages,
  detailsHeadline,
  site,
  siteHeadline,
  fallbackSettings,
  hasSettings,
}: {
  deviceId: string;
  sync: DeviceSyncInit;
  fields: SettingField[];
  enumOptions: Record<string, EnumOption[]>;
  /** The settings log so far, newest first (it follows new rows live). */
  log: ConfigLogRow[];
  /** A solar inverter's settings are sorted like its own menu (Basic, Battery, Work mode, ...); another device keeps its own categories. */
  mode: "areas" | "categories";
  /** The device itself first, then each part installed under it (solar panels, battery, generator, UPS ...), each as a heading with cards. */
  devicePages: { id: string; node: React.ReactNode }[];
  detailsHeadline: HeadlineData;
  site: React.ReactNode;
  siteHeadline: HeadlineData;
  /** A device whose settings are not from the catalogue (a battery store) brings its own content. */
  fallbackSettings: React.ReactNode | null;
  hasSettings: boolean;
}) {
  const tabs = React.useMemo<Tab[]>(() => {
    const list: Tab[] = [
      {
        id: "details",
        label: "Device info",
        icon: Info,
        tone: "primary",
        kind: "details",
        fields: [],
        isDevice: true,
        headline: detailsHeadline,
        node: (
          <div className="space-y-10">
            {devicePages.map((p) => (
              <React.Fragment key={p.id}>{p.node}</React.Fragment>
            ))}
          </div>
        ),
      },
    ];
    list.push({ id: "site", label: "Site", icon: MapPin, tone: "sky", kind: "site", fields: [], node: site, headline: siteHeadline });
    if (hasSettings) {
      if (fallbackSettings) list.push({ id: "settings", label: "Settings", icon: SlidersHorizontal, tone: "amber", kind: "settings", fields: [], node: fallbackSettings });
      else if (mode === "areas") {
        for (const a of AREA_ORDER) {
          if (fields.some((f) => f.area === a)) list.push({ id: `settings-${a}`, label: AREA_LABEL[a], icon: AREA_META[a].icon, tone: "amber", kind: "settings", fields: fields.filter((f) => f.area === a), description: AREA_META[a].description });
        }
      } else {
        for (const c of Array.from(new Set(fields.map((f) => f.category))).sort()) {
          list.push({ id: `settings-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: c, icon: SlidersHorizontal, tone: "amber", kind: "settings", fields: fields.filter((f) => f.category === c) });
        }
      }
    }
    return list;
  }, [devicePages, detailsHeadline, site, siteHeadline, hasSettings, fallbackSettings, mode, fields]);

  const [current, open] = useHashTab(
    tabs.map((t) => t.id),
    tabs[0].id
  );
  const tab = tabs.find((t) => t.id === current) ?? tabs[0];

  return (
    <SettingsProvider deviceId={deviceId} fields={fields} enumOptions={enumOptions} log={log}>
      <div className="space-y-5">
        <Headline deviceId={deviceId} sync={sync} tab={tab} />

        <Tabs value={tab.id} onValueChange={open}>
          <TabsList variant="line">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id} variant="line" className={TAB_ACCENT[t.tone]}>
                <t.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
                <span className="text-sm font-medium">{t.label}</span>
                {t.kind === "settings" && <AttentionDot fields={t.fields} />}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div key={tab.id} className="space-y-4">
          {tab.description && <p className="text-sm text-theme-muted">{tab.description}</p>}
          {tab.kind === "settings" && tab.fields.length > 0 ? <SettingsPane fields={tab.fields} /> : tab.node}
        </div>
      </div>
    </SettingsProvider>
  );
}

/** A small amber dot beside a settings tab while one of its settings is waiting for the inverter or was not taken. */
function AttentionDot({ fields }: { fields: SettingField[] }) {
  const attention = useNeedsAttention(fields);
  return attention ? <span aria-label="has a change waiting or not matching" className="size-1.5 rounded-full bg-amber-500" /> : null;
}

/** The line above the tabs, like Performance's and Maintenance's: a round icon, the open tab's own headline, and a few more figures. */
function Headline({ deviceId, sync, tab }: { deviceId: string; sync: DeviceSyncInit; tab: Tab }) {
  const state = useDeviceState(deviceId, sync);
  const summary = useSettingsSummary(tab.fields);
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const settingsHead: HeadlineData = {
    label: tab.label,
    value: summary.notTaken > 0 ? `${summary.notTaken} not taken` : summary.waiting > 0 ? `${summary.waiting} waiting` : summary.lastRead ? "All confirmed" : "Not read yet",
    figures: [
      { label: "Last read", value: summary.lastRead ? agoText(clock - new Date(summary.lastRead).getTime()) : "—" },
      { label: "Settings", value: String(summary.total) },
    ],
  };
  const base = tab.kind === "settings" ? settingsHead : (tab.headline ?? { label: tab.label, value: tab.label, figures: [] });
  const head: HeadlineData = tab.isDevice ? { ...base, figures: [{ label: "Status", value: STATE_TEXT[state.status] }, ...base.figures] } : base;
  const settingsTone = tab.kind === "settings" && tab.fields.length > 0 ? (summary.notTaken > 0 ? "text-destructive" : summary.waiting > 0 ? "text-amber-600 dark:text-amber-400" : summary.lastRead ? "text-emerald-600 dark:text-emerald-400" : null) : null;
  const Icon = tab.icon;

  return (
    <div className="flex min-w-0 items-center gap-4">
      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", TONE_CIRCLE[tab.tone])}>
        <Icon className="size-7" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-theme-muted">{head.label}</p>
        <p className={cn("truncate text-3xl font-semibold leading-tight tracking-tight sm:text-4xl", settingsTone ?? "text-theme-primary")}>{head.value}</p>
      </div>
      <div className="hidden items-center gap-8 pl-6 md:flex">
        {head.figures.map((f) => (
          <div key={f.label}>
            <p className="text-sm font-medium text-theme-muted">{f.label}</p>
            <p className="text-2xl font-semibold tracking-tight text-theme-primary">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
