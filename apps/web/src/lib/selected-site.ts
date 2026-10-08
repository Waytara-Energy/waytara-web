import "server-only";
import { isMonitoredCategory } from "./equipment-children";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@waytara/supabase/server";
import type { SiteAddress } from "./site-catalog";
import { deviceDisplayId, type CustomerDevice } from "./device-display";

export const SELECTED_SITE_COOKIE = "selected_site_id";
export const SELECTED_DEVICE_COOKIE = "selected_device_id";

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
      "id, name, property_type, power_source_category, power_package, latitude, longitude, address, equipment(id, label, device_status, parent_id, created_at, installed_at, warranty_start_date, warranty_end_date, service_id, device_type:equipment_inventory(id, category, name, manufacturer, brand, model, serial_number, model_number))"
    )
    // A site hidden from the customer (hidden_at set by staff) is left out here and so everywhere: the site list, the device
    // icons, and every page's scoping. Nothing is deleted.
    .is("customer_hidden_at", null)
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
    // Child equipment (panels, a battery ...) belongs to an inverter; the Performance page reads it, but it is not a
    // device with readings of its own, so only the monitored devices are listed.
    devices: (s.equipment ?? [])
      .filter((d) => d.parent_id === null && (!d.device_type || isMonitoredCategory(d.device_type.category)))
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
 *  (Devices, Monitoring, Performance, Reports, Maintenance) needs now that
 *  a site can have more than one device. Priority order:
 *   1. This page's own `?device=` searchParam, if it belongs to this site
 *      — an explicit choice made *on this page* always wins.
 *   2. `SELECTED_DEVICE_COOKIE`, if it belongs to this site — the device
 *      last picked via DeviceSwitcher on *any* page (DeviceSwitcher's own
 *      selectDevice action sets it), so navigating over from Monitoring to
 *      Performance via the sidebar lands on the same device instead of
 *      silently resetting to the first one.
 *   3. The site's first device.
 *  Neither id is ever trusted blindly — both are checked against this
 *  already-RLS-scoped site's own device list before use, same
 *  don't-trust-the-id-blindly reasoning as resolveSelectedSite. */
export async function resolveDeviceInSite(site: CustomerSite | null, deviceId: string | undefined): Promise<CustomerDevice | null> {
  if (!site || site.devices.length === 0) return null;
  const byParam = site.devices.find((d) => d.id === deviceId);
  if (byParam) return byParam;

  const cookieStore = await cookies();
  const cookieDeviceId = cookieStore.get(SELECTED_DEVICE_COOKIE)?.value;
  const byCookie = site.devices.find((d) => d.id === cookieDeviceId);
  if (byCookie) return byCookie;

  return site.devices[0];
}
