import type { Viewport } from "next";
import { Zap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { deviceDisplayId, getSelectedSite } from "@/lib/selected-site";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchSiteOverview } from "@/lib/device-overview";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LiveChannelKeeper } from "@/components/dashboard/overview-live";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { SITE_OVERVIEW_KEYS } from "@/lib/overview-keys";
import { fetchSolarCardsProps } from "@/components/dashboard/solar-live-status-cards";
import { EvOverviewBoard } from "@/components/dashboard/ev-overview-board";
import { fetchEvHistory, type EvHistory } from "@/lib/ev-history";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { fetchEvOverview } from "@/lib/ev-overview";
import { getCustomerPlan } from "@/lib/customer-plan";
import { parseCarProfile } from "@/lib/ev-car";
import { OverviewBoard } from "@/components/dashboard/overview-board";
import { OverviewCarousel, type OverviewSlide } from "@/components/dashboard/overview-carousel";
import { OverviewSky } from "@/components/dashboard/overview-sky";
import { getLastSyncInfo } from "@/lib/device-sync";
import { backgroundCss, initialSlideIndex, parseOverviewPrefs } from "@/lib/overview-prefs";

// The browser's bar colour on the Overview, from the first byte: the cloud sky's top colour (the script in OverviewSky then keeps it in step with the theme
// being shown and with the scroll). Without it the HTML starts with the plain page colours and an iPhone, which reads them at load, paints its status bar
// white (or near black) above the sky.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5f9fd6" },
    { media: "(prefers-color-scheme: dark)", color: "#070d1f" },
  ],
};

// Site-centric redesign: Overview is now the selected *site*'s overview —
// a customer can have several sites, and each site can have several
// devices (a real install is rarely just one instrument). There's no
// per-device filter here anymore (that's what the Devices module is for,
// see /dashboard/devices) — Overview always shows the site's *combined*
// picture: the site's weather up top (its own location, so it belongs here
// rather than per device), then every inverter's flow/energy numbers and
// every charger's power summed into one energy-flow diagram
// (fetchSiteOverview), and recent alerts pooled across every device at
// the site.
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

  // One Overview per device (a slide each, in the order the devices were added): an inverter's energy flow and cards, a charger's status and
  // cards. Each is fetched for a site made of that one device, so a slide shows that device's own numbers and not the site's sum.
  const emptySync: DeviceSyncInit = { lastTs: null, agentSeenTs: null, deviceOnline: null, intervalS: null, heartbeatS: null };
  type SlideData =
    | { kind: "inverter"; device: (typeof site.devices)[number]; syncInit: DeviceSyncInit; pvKeys: string[]; initial: Record<string, number | null>; solar: Awaited<ReturnType<typeof fetchSolarCardsProps>> }
    | { kind: "charger"; device: (typeof site.devices)[number]; ev: Awaited<ReturnType<typeof fetchEvOverview>>; history: EvHistory };
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
          const history = await fetchEvHistory(supabase, device.id, plan?.tariffRatePerKwh ?? 8);
          return { kind: "charger", device, ev, history };
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

  const slides: OverviewSlide[] = slideData.flatMap((d): OverviewSlide[] => {
    if (!d) return [];
    if (d.kind === "inverter") {
      return [
        {
          id: d.device.id,
          name: deviceDisplayId(d.device),
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
        content: (
          <EvOverviewBoard
            chargerId={d.device.id}
            connected={d.ev.connected}
            connectorOptions={d.ev.connectorOptions}
            open={d.ev.open}
            initial={d.ev.latest}
            history={d.history}
            car={car}
          />
        ),
      },
    ];
  });

  return (
    <div className="space-y-4">
      {/* Live numbers (status pill, fault banner, energy flow, status cards, charts) update in place from the
          device's live channel - there is no page refresh on new readings. The channel is only open while this
          tab is visible. */}
      <LiveChannelKeeper deviceIds={[...inverterIds, ...chargerIds]} />
      {/* The energy flow's colour key is a row in the sidebar, above Support. */}
      {/* A charging session opening is an INSERT on ev_sessions, closing it an UPDATE of the same row: both refresh a charger's slide. */}
      {chargerIds.length > 0 && (
        <>
          <RealtimeRefresh table="ev_sessions" event="INSERT" filter={`equipment_id=in.(${chargerIds.join(",")})`} />
          <RealtimeRefresh table="ev_sessions" event="UPDATE" filter={`equipment_id=in.(${chargerIds.join(",")})`} />
        </>
      )}
      {/* The device status icons (each one a live connection) are in the page header on every page, and an offline device is announced by a toast
          at the top (both live in the dashboard layout). */}

      {/* The cloud sky across the top, unless the person chose a background of their own (then that is what shows). */}
      {slides.length > 0 && !background && <OverviewSky />}

      {slides.length === 0 ? (
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
        <OverviewCarousel slides={slides} initialIndex={initialSlideIndex(slides.map((s) => s.id), slides.some((s) => s.id === deviceParam) ? (deviceParam ?? null) : overviewPrefs.device)} background={background} />
      )}
    </div>
  );
}
