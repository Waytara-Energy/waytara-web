import type { Viewport } from "next";
import { Zap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { deviceDisplayId, getSelectedSite } from "@/lib/selected-site";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchSiteOverview } from "@/lib/device-overview";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LiveChannelKeeper } from "@/components/dashboard/overview-live";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { SITE_OVERVIEW_KEYS, siteAgg } from "@/lib/overview-keys";
import { fetchSolarCardsProps } from "@/components/dashboard/solar-live-status-cards";
import { EvOverviewBoard } from "@/components/dashboard/ev-overview-board";
import { fetchEvHistory, type EvHistory } from "@/lib/ev-history";
import { fetchEvLog, type EvLogEntry } from "@/lib/ev-log";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { fetchEvOverview } from "@/lib/ev-overview";
import { getCustomerPlan } from "@/lib/customer-plan";
import { parseCarProfile } from "@/lib/ev-car";
import { OverviewBoard } from "@/components/dashboard/overview-board";
import { OverviewTabs, SITE_TAB, type OverviewTab } from "@/components/dashboard/overview-tabs";
import { SiteOverviewBoard, type SiteBoardCharger, type SiteBoardDevice, type SiteBoardInverters } from "@/components/dashboard/site-overview-board";
import type { ConnectionStatus } from "@/lib/device-state";
import { getLastSyncInfo } from "@/lib/device-sync";
import { backgroundCss, parseOverviewPrefs } from "@/lib/overview-prefs";

// The browser's bar colour on the Overview, from the first byte: the cloud sky's top colour (the script in OverviewSky then keeps it in step with the theme
// being shown and with the scroll). Without it the HTML starts with the plain page colours and an iPhone, which reads them at load, paints its status bar
// white (or near black) above the sky.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5f9fd6" },
    { media: "(prefers-color-scheme: dark)", color: "#070d1f" },
  ],
};

// The Overview of the selected site, as tabs: first the site's own Overview (every device together, as widgets: solar, the weather at the site, the
// devices and their state, load, grid, battery, the charger), then one tab per device (an inverter's energy flow and cards, a charger's page).

/** How one metric of several inverters combines into the site's number: powers and day counters add up, state of charge averages, a state or
 *  fault register takes the worst (see siteAgg). Null when no inverter has a value. */
function combine(key: string, values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (v.length === 0) return null;
  const how = siteAgg(key);
  if (how === "avg") return v.reduce((a, b) => a + b, 0) / v.length;
  if (how === "max") return Math.max(...v);
  return v.reduce((a, b) => a + b, 0);
}

export default async function DashboardOverviewPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const supabase = await createClient();
  // Independent of each other — getRequestProfile is cache()-deduped
  // against the layout's own call anyway (and free in the common case, see
  // @/lib/request-profile), but running it alongside the site lookup
  // rather than after it still saves a round trip's worth of latency on
  // whichever one is slower.
  const [profile, site, { device: deviceParam }] = await Promise.all([getRequestProfile(), getSelectedSite(), searchParams]);

  if (!site) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Zap />
            </EmptyMedia>
            <EmptyTitle>No sites yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const chargerIds = site.devices.filter((d) => d.deviceType?.category === "ev_charger").map((d) => d.id);
  const inverters = site.devices.filter((d) => d.deviceType?.category === "solar_inverter");
  const inverterIds = inverters.map((d) => d.id);

  // One Overview per device (a tab each, in the order the devices were added): an inverter's energy flow and cards, a charger's status and
  // cards. Each is fetched for a site made of that one device, so a tab shows that device's own numbers and not the site's sum.
  const emptySync: DeviceSyncInit = { lastTs: null, agentSeenTs: null, deviceOnline: null, intervalS: null, heartbeatS: null };
  type SlideData =
    | { kind: "inverter"; device: (typeof site.devices)[number]; syncInit: DeviceSyncInit; pvKeys: string[]; initial: Record<string, number | null>; solar: Awaited<ReturnType<typeof fetchSolarCardsProps>> }
    | { kind: "charger"; device: (typeof site.devices)[number]; ev: Awaited<ReturnType<typeof fetchEvOverview>>; history: EvHistory; log: EvLogEntry[]; tariff: number };
  const [slideData, uiRow] = await Promise.all([
    Promise.all(
      site.devices.map(async (device): Promise<SlideData | null> => {
        const one = { ...site, devices: [device] };
        const category = device.deviceType?.category;
        if (category === "solar_inverter") {
          const [overview, sync] = await Promise.all([fetchSiteOverview(supabase, one), getLastSyncInfo(device.id)]);
          const syncInit: DeviceSyncInit = sync ?? emptySync;
          const pvKeys = overview.pvKeys ?? [];
          const initial: Record<string, number | null> = Object.fromEntries([...SITE_OVERVIEW_KEYS, ...pvKeys].map((k) => [k, overview.get(k)]));
          // The first numbers of the cards beside the energy flow (the live channel keeps them current afterwards).
          const solar = await fetchSolarCardsProps(supabase, one, syncInit, pvKeys);
          return { kind: "inverter", device, syncInit, pvKeys, initial, solar };
        }
        if (category === "ev_charger") {
          const [ev, plan] = await Promise.all([fetchEvOverview(supabase, device.id), getCustomerPlan()]);
          const [history, log] = await Promise.all([fetchEvHistory(supabase, device.id, plan?.tariffRatePerKwh ?? 8), fetchEvLog(supabase, device.id)]);
          return { kind: "charger", device, ev, history, log, tariff: plan?.tariffRatePerKwh ?? 8 };
        }
        return null;
      }),
    ),
    // the person's own choices for this page (which four cards, what is behind it, which device it opens on): see Application Settings
    profile ? supabase.from("profiles").select("ui_preferences").eq("id", profile.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const overviewPrefs = parseOverviewPrefs(uiRow.data?.ui_preferences);
  const car = parseCarProfile(uiRow.data?.ui_preferences);
  const backgroundUrl = overviewPrefs.background.kind === "image" ? supabase.storage.from("avatars").getPublicUrl(overviewPrefs.background.path).data.publicUrl : null;
  const background = backgroundCss(overviewPrefs.background, backgroundUrl, overviewPrefs.dim);

  const deviceTabs: OverviewTab[] = slideData.flatMap((d): OverviewTab[] => {
    if (!d) return [];
    if (d.kind === "inverter") {
      return [
        {
          id: d.device.id,
          name: deviceDisplayId(d.device),
          kind: "inverter",
          sky: true,
          content: (
            <OverviewBoard
              cards={overviewPrefs.cards}
              background={background}
              backdrop={false}
              solar={d.solar}
              flow={{
                inverterIds: [d.device.id],
                initial: d.initial,
                powerPackage: site.powerPackage,
                powerSourceCategory: site.powerSourceCategory,
                pvKeys: d.pvKeys,
                sync: d.syncInit,
              }}
            />
          ),
        },
      ];
    }
    return [
      {
        id: d.device.id,
        name: deviceDisplayId(d.device),
        kind: "charger",
        sky: false,
        content: (
          <EvOverviewBoard
            chargerId={d.device.id}
            connected={d.ev.connected}
            connectorOptions={d.ev.connectorOptions}
            open={d.ev.open}
            initial={d.ev.latest}
            history={d.history}
            log={d.log}
            car={car}
            tariff={d.tariff}
          />
        ),
      },
    ];
  });

  // ---- the site's own Overview (the first tab): what its widgets start from ----
  const inverterData = slideData.flatMap((d) => (d && d.kind === "inverter" ? [d] : []));
  const chargerData = slideData.flatMap((d) => (d && d.kind === "charger" ? [d] : []));
  const sitePvKeys = [...new Set(inverterData.flatMap((d) => d.pvKeys))].sort();
  const siteKeys = [...new Set(inverterData.flatMap((d) => [...Object.keys(d.initial), ...Object.keys(d.solar?.initial ?? {})]))];
  const siteInverters: SiteBoardInverters | null =
    inverterData.length === 0
      ? null
      : {
          ids: inverterData.map((d) => d.device.id),
          initial: Object.fromEntries(siteKeys.map((k) => [k, combine(k, inverterData.map((d) => d.initial[k] ?? d.solar?.initial[k]))])),
          pvKeys: sitePvKeys,
          // power_package says what the site has (null = not set: nothing is hidden); an off-grid site has no grid
          hasBattery: site.powerPackage === null || site.powerPackage.includes("battery"),
          hasGrid: site.powerSourceCategory !== "off_grid",
        };
  const siteChargers: SiteBoardCharger[] = chargerData.map((d) => ({
    id: d.device.id,
    name: deviceDisplayId(d.device),
    connected: d.ev.connected,
    connectorOptions: d.ev.connectorOptions,
    open: d.ev.open,
    initial: d.ev.latest,
    todayKwh: d.ev.todayKwh,
    last: d.history.recent[0] ?? null,
    sessions30: d.history.sessions30,
    kwh30: d.history.kwh30,
  }));
  const siteDevices: SiteBoardDevice[] = site.devices.map((device) => {
    const data = slideData.find((d) => d?.device.id === device.id);
    let status: ConnectionStatus | null = null;
    if (data?.kind === "inverter") {
      const verdict = data.syncInit.verdict?.status ?? null;
      status = verdict === null ? null : verdict === "online" ? "online" : verdict === "device_unreachable" ? "connection_lost" : "offline";
    } else if (data?.kind === "charger") {
      status = data.ev.connected === null ? null : data.ev.connected ? "online" : "offline";
    }
    const type = device.deviceType;
    return {
      id: device.id,
      name: deviceDisplayId(device),
      kind: data?.kind === "inverter" ? "inverter" : data?.kind === "charger" ? "charger" : "other",
      model: type ? [type.brand ?? type.manufacturer, type.model ?? type.name].filter(Boolean).join(" ") || null : null,
      status,
    };
  });
  const tabs: OverviewTab[] =
    deviceTabs.length === 0
      ? []
      : [
          {
            id: SITE_TAB,
            name: "Overview",
            kind: "site",
            sky: false,
            content: <SiteOverviewBoard siteId={site.id} place={site.address?.city ?? site.name} devices={siteDevices} inverters={siteInverters} chargers={siteChargers} car={car} background={background} />,
          },
          ...deviceTabs,
        ];
  // the tab it opens on: the device asked for in the address, else the one chosen in Application Settings, else the site's Overview
  const wanted = deviceTabs.some((t) => t.id === deviceParam) ? deviceParam : deviceTabs.some((t) => t.id === overviewPrefs.device) ? overviewPrefs.device : null;

  return (
    <div className="space-y-4">
      {/* Live numbers (status pill, fault banner, energy flow, status cards, charts) update in place from the
          device's live channel - there is no page refresh on new readings. The channel is only open while this
          tab is visible. */}
      <LiveChannelKeeper deviceIds={[...inverterIds, ...chargerIds]} />
      {/* The energy flow's colour key is a row in the sidebar, above Support. */}
      {/* A charging session opening is an INSERT on ev_sessions, closing it an UPDATE of the same row: both refresh the charger's numbers. */}
      {chargerIds.length > 0 && (
        <>
          <RealtimeRefresh table="ev_sessions" event="INSERT" filter={`equipment_id=in.(${chargerIds.join(",")})`} />
          <RealtimeRefresh table="ev_sessions" event="UPDATE" filter={`equipment_id=in.(${chargerIds.join(",")})`} />
        </>
      )}
      {/* The device status icons (each one a live connection) are in the page header on every page, and an offline device is announced by a toast
          at the top (both live in the dashboard layout). */}

      {tabs.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Zap />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <OverviewTabs tabs={tabs} initialId={wanted ?? SITE_TAB} background={background} />
      )}
    </div>
  );
}
