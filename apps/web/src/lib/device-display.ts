// Split out of selected-site.ts (which is "server-only", since it also
// reads cookies()) — CustomerDevice's shape and deviceDisplayId are plain
// data/logic with nothing server-specific about them, and DeviceSwitcher
// (a client component) needs both without pulling in next/headers.
// selected-site.ts re-exports both so every existing server-side import
// site keeps working unchanged.

export interface CustomerDevice {
  id: string;
  label: string | null;
  deviceStatus: string;
  createdAt: string;
  installedAt: string | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  serviceId: string | null;
  deviceType: {
    id: string;
    category: string;
    name: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    modelNumber: string | null;
  } | null;
}

/** The per-unit identifier shown wherever a device needs a short label
 *  beyond its (optional) friendly name — onboarding's device list, admin
 *  rows, dashboard fallbacks. `devices` no longer carries its own
 *  free-typed serial (`device_uid` was dropped); a `stock` row already
 *  represents one specific purchased/serialized unit in how this catalog
 *  is actually used, so its own serial number is the faithful per-unit
 *  identifier, falling back to the model number for non-serialized items. */
export function deviceDisplayId(device: CustomerDevice): string {
  return device.label || device.deviceType?.serialNumber || device.deviceType?.modelNumber || "Device";
}
