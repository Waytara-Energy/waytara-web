import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@waytara/supabase/server";

export const SELECTED_DEVICE_COOKIE = "selected_device_id";

export interface CustomerDevice {
  id: string;
  label: string | null;
  deviceUid: string;
  status: string;
  createdAt: string;
  deviceType: { id: string; code: string; name: string } | null;
  site: { id: string; name: string } | null;
}

/** Every device this customer owns, RLS-scoped, oldest first — the list
 *  both the header switcher and `getSelectedDevice` work from. Device is
 *  now the dashboard's navigation root: every device-scoped page calls
 *  `getSelectedDevice`, not "all devices for this customer". */
export async function getCustomerDevices(): Promise<CustomerDevice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select(
      "id, label, device_uid, status, created_at, device_type:device_types(id, code, name), site:sites(id, name)"
    )
    .order("created_at", { ascending: true });

  return (data ?? []).map((d) => ({
    id: d.id,
    label: d.label,
    deviceUid: d.device_uid,
    status: d.status,
    createdAt: d.created_at,
    deviceType: d.device_type,
    site: d.site,
  }));
}

/** Picks the cookie-selected device out of an already-fetched list, falling
 *  back to the first (oldest) device. Never trusts the cookie's id blindly
 *  as "the" device — `devices` is already RLS-scoped to this customer, so a
 *  stale or foreign id just silently falls through to that default instead
 *  of granting access to anything. */
export function resolveSelectedDevice(
  devices: CustomerDevice[],
  selectedId: string | undefined
): CustomerDevice | null {
  if (devices.length === 0) return null;
  return devices.find((d) => d.id === selectedId) ?? devices[0];
}

/** The one-stop call for any device-scoped page: fetches the customer's
 *  devices and resolves which one is selected, in one helper — mirrors how
 *  `getCurrentProfile()` is the one place every page gets the signed-in
 *  profile. */
export async function getSelectedDevice(): Promise<CustomerDevice | null> {
  const devices = await getCustomerDevices();
  const cookieStore = await cookies();
  return resolveSelectedDevice(devices, cookieStore.get(SELECTED_DEVICE_COOKIE)?.value);
}
