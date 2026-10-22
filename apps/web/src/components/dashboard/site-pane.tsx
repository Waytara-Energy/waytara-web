import { Building, Building2, Factory, Home, PlugZap, Server, Store, Truck, Unplug, Waypoints, type LucideIcon } from "lucide-react";
import type { CustomerDevice, CustomerSite } from "@/lib/selected-site";
import { PROPERTY_TYPE_LABELS, POWER_SOURCE_LABELS } from "@/lib/site-catalog";
import { Card } from "@/components/ui/card";
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
      <span className="flex size-12 items-center justify-center rounded-full border border-border bg-background shadow-sm">
        <Icon className="size-6 text-foreground/80" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-snug text-foreground">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

/** The Site page: a full-page map with two cards over it on the left. The first says what kind of site it is (property type and power source,
 *  set by your WayTara advisor, as icons, with an EV charger next to them when the site has one); the second holds the site's details and
 *  Edit site (see SiteLocation). The weather has its own page, opened from the header. */
export function SitePane({ device, site }: { device: CustomerDevice; site: CustomerSite }) {
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
      kind={
        <Card className="gap-0 border-border/60 bg-card/95 p-4 shadow-xl backdrop-blur">
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
