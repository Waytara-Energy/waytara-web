import { redirect } from "next/navigation";

// Instrument Settings folded into the Devices module — settings now live
// on the Devices page itself (Device Details / Site Details / Settings by
// category), picked via `?device=` same as every other device-scoped page.
// This shim forwards any old link/bookmark carrying `?device=<id>`.
export default async function InstrumentSettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  const { device } = await searchParams;
  redirect(device ? `/dashboard/devices?device=${device}` : "/dashboard/devices");
}
