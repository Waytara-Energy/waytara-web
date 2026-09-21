import { redirect } from "next/navigation";

// Instrument Settings folded into the Devices module — settings now live
// on a device's own detail page (Device Details / Site Details / Settings
// by category), reached by picking a device from /dashboard/devices
// rather than a `?device=` picker on a dedicated settings page. This shim
// forwards any old link/bookmark: `?device=<id>` goes straight to that
// device's detail page, otherwise to the Devices list to pick one.
export default async function InstrumentSettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  const { device } = await searchParams;
  redirect(device ? `/dashboard/devices/${device}` : "/dashboard/devices");
}
