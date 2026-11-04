import { redirect } from "next/navigation";

/** The charging sessions are a part of Reports now (its EV Charger tab); an old bookmark or link comes here and is sent on. */
export default async function EvSessionsRedirect({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const { device } = await searchParams;
  redirect(`/dashboard/reports${device ? `?device=${encodeURIComponent(device)}` : ""}#ev`);
}
