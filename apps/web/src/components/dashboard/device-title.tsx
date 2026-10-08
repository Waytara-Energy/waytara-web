import { deviceDisplayId, type CustomerDevice } from "@/lib/device-display";

/** The name of the device a page is about, as the page's heading. It is plain text: the device is picked with the device icons in the
 *  page header (DeviceStatusIcon), the same on every page. */
export function DeviceTitle({ devices, selectedId }: { devices: CustomerDevice[]; selectedId: string }) {
  const selected = devices.find((d) => d.id === selectedId) ?? devices[0];
  return <h1 className="min-w-0 truncate text-xl font-semibold text-theme-primary">{selected ? deviceDisplayId(selected) : "Device"}</h1>;
}
