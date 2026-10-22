import { Building, Building2, Factory, Home, PlugZap, Server, Store, Truck, Unplug, Waypoints, type LucideIcon } from "lucide-react";
import type { CustomerDevice, CustomerSite } from "@/lib/selected-site";
import { PROPERTY_TYPE_LABELS, POWER_SOURCE_LABELS } from "@/lib/site-catalog";
import { Card } from "@/components/ui/card";
import { GLASS } from "./glass";
import { SiteDevices, type SiteDevice } from "./site-devices";
import { SiteLocation } from "./site-location";

// An icon for each kind of property and each way of getting power (the labels are the catalogue's own).
const PROPERTY_ICON: Record<string, LucideIcon> = {
  residential_independent_villas: Home,
  gated_communities_rwas_high_rises: Building2,
  factories_heavy_engineering_processing_plants: Factory,
  corporate_offices_hospitals_hotels_retail: Store,
  logistics_delivery_hubs_bus_depots: Truck,
  tech_parks_data_centers_rnd_hubs: Server,
};
const POWER_ICON: Record<string, LucideIcon> = { grid_tied: PlugZap, off_grid: Unplug, hybrid: Waypoints };

/** One fact about the site as a round icon with its words under it. */
function Tile({ icon: Icon, caption, value }: { icon: LucideIcon; caption: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background/70 shadow-sm md:size-12">
        <Icon className="size-5 text-foreground/80 md:size-6" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium leading-snug text-foreground md:text-[13px]">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

/** The Site page: a full-page map with two glass cards over it on the left. The first says what kind of site it is (property type and power
 *  source, set by your WayTara advisor, as icons, with an EV charger next to them when the site has one); the second holds the site's address,
 *  its devices with their status, and Edit site (see SiteLocation). The weather has its own page, opened from the header. */
export function SitePane({ device, site, devices }: { device: CustomerDevice; site: CustomerSite; devices: SiteDevice[] }) {
  const property = PROPERTY_TYPE_LABELS[site.propertyType] ?? site.propertyType;
  const power = POWER_SOURCE_LABELS[site.powerSourceCategory] ?? site.powerSourceCategory;
  const chargers = site.devices.filter((d) => d.deviceType?.category === "ev_charger").length;
  return (
    <SiteLocation
      key={device.id}
      deviceId={device.id}
      siteName={site.name}
      deviceLabel={device.label}
      deviceName={device.deviceType?.name ?? "Device"}
      latitude={site.latitude}
      longitude={site.longitude}
      address={site.address}
      devices={<SiteDevices devices={devices} />}
      kind={
        <Card className={`${GLASS} gap-0 p-3 md:p-4`}>
          <div className="flex items-start justify-center gap-3">
            <Tile icon={PROPERTY_ICON[site.propertyType] ?? Building} caption="Property type" value={property} />
            <Tile icon={POWER_ICON[site.powerSourceCategory] ?? PlugZap} caption="Power source" value={power} />
            {chargers > 0 && <Tile icon={PlugZap} caption="EV charger" value={chargers === 1 ? "Installed" : `${chargers} installed`} />}
          </div>
        </Card>
      }
    />
  );
}
