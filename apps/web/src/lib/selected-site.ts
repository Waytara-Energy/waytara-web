import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@waytara/supabase/server";
import type { SiteAddress } from "./site-catalog";
import { deviceDisplayId, type CustomerDevice } from "./device-display";

export const SELECTED_SITE_COOKIE = "selected_site_id";

// CustomerDevice's shape and deviceDisplayId live in device-display.ts (no
// "server-only" there) so a client component like DeviceSwitcher can import
// them without pulling in next/headers — re-exported here so every
// existing `from "@/lib/selected-site"` import site keeps working as-is.
export { deviceDisplayId, type CustomerDevice };

export interface CustomerSite {
  id: string;
  name: string;
  propertyType: string;
  powerSourceCategory: string;
  powerPackage: string | null;
  latitude: number | null;
  longitude: number | null;
  address: SiteAddress | null;
  devices: CustomerDevice[];
}

/** Every site this customer owns, RLS-scoped, oldest first, each with its
 *  own devices nested — site is the dashboard's navigation root: a
 *  customer can have several sites (properties), and each site can have
 *  several devices (a real install is rarely just one instrument). The
 *  header switcher and `getSelectedSite` both work from this.
 *
 *  Wrapped in React's `cache()` — the layout fetches this once for the
 *  header switcher, and every page fetches it again (via `getSelectedSite`)
 *  for its own scoping. `cache()` dedupes those into a single `sites`
 *  query per request instead of two. */
export const getCustomerSites = cache(async function getCustomerSites(): Promise<CustomerSite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select(
      "id, name, property_type, power_source_category, power_package, latitude, longitude, address, devices(id, label, device_status, created_at, installed_at, warranty_start_date, warranty_end_date, service_id, device_type:stock(id, category, name, manufacturer, brand, model, serial_number, model_number))"
    )
    .order("created_at", { ascending: true });

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    propertyType: s.property_type,
    powerSourceCategory: s.power_source_category,
    powerPackage: s.power_package,
    latitude: s.latitude,
    longitude: s.longitude,
    address: (s.address as SiteAddress | null) ?? null,
    devices: (s.devices ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((d) => ({
        id: d.id,
        label: d.label,
        deviceStatus: d.device_status,
        createdAt: d.created_at,
        installedAt: d.installed_at,
        warrantyStartDate: d.warranty_start_date,
        warrantyEndDate: d.warranty_end_date,
        serviceId: d.service_id,
        deviceType: d.device_type
          ? {
              id: d.device_type.id,
              category: d.device_type.category,
              name: d.device_type.name,
              manufacturer: d.device_type.manufacturer,
              brand: d.device_type.brand,
              model: d.device_type.model,
              serialNumber: d.device_type.serial_number,
              modelNumber: d.device_type.model_number,
            }
          : null,
      })),
  }));
});

/** Picks the cookie-selected site out of an already-fetched list, falling
 *  back to the first (oldest) site. Never trusts the cookie's id blindly as
 *  "the" site — `sites` is already RLS-scoped to this customer, so a stale
 *  or foreign id just silently falls through to that default instead of
 *  granting access to anything. */
export function resolveSelectedSite(sites: CustomerSite[], selectedId: string | undefined): CustomerSite | null {
  if (sites.length === 0) return null;
  return sites.find((s) => s.id === selectedId) ?? sites[0];
}

/** The one-stop call for any site-scoped page: fetches the customer's sites
 *  and resolves which one is selected, in one helper — mirrors how
 *  `getCurrentProfile()` is the one place every page gets the signed-in
 *  profile. */
export async function getSelectedSite(): Promise<CustomerSite | null> {
  const sites = await getCustomerSites();
  const cookieStore = await cookies();
  return resolveSelectedSite(sites, cookieStore.get(SELECTED_SITE_COOKIE)?.value);
}

/** Picks a device out of the *selected site's own* device list — this is
 *  the second, page-local level of selection every device-scoped page
 *  (Analytics, Monitoring, Performance, Instrument Settings, Maintenance)
 *  needs now that a site can have more than one device: each of those
 *  pages reads `?device=` from its own searchParams and resolves it here,
 *  independently of whatever any other page currently has picked — there's
 *  no single global "current device" the way there was before sites could
 *  hold more than one. Falls back to the first device at the site when
 *  `deviceId` is missing or doesn't belong to this site (same
 *  don't-trust-the-id-blindly reasoning as resolveSelectedSite). */
export function resolveDeviceInSite(site: CustomerSite | null, deviceId: string | undefined): CustomerDevice | null {
  if (!site || site.devices.length === 0) return null;
  return site.devices.find((d) => d.id === deviceId) ?? site.devices[0];
}
