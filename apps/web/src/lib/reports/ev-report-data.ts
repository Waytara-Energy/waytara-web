import "server-only";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchResolvedTariff } from "@/lib/tariff-server";
import { EV_PERF_COLUMNS, spanOfDays, type EvPerfSession } from "@/lib/ev-perf-stats";
import { CATEGORY_LABEL } from "@/lib/tariff";
import { fmtDate } from "@/lib/savings";
import { buildEvReport, type EvReport } from "./ev-report";

/** The most sessions one report lists (the page and the downloads read the same number). */
const MAX_SESSIONS = 5000;

export type EvReportResult = { ok: true; report: EvReport } | { ok: false; status: 403 | 404; error: string };

/** The EV charging report of one charger and period, read as whoever is signed in (RLS scopes it) and priced on the site's tariff. */
export async function gatherEvReport(deviceIdParam: string | undefined, from: string, to: string): Promise<EvReportResult> {
  const [profile, site, plan] = await Promise.all([getRequestProfile(), getSelectedSite(), getCustomerPlan()]);
  if (!profile || !(plan?.features ?? {}).reports) return { ok: false, status: 403, error: "Not available on your plan." };
  const device = await resolveDeviceInSite(site, deviceIdParam);
  if (!device || device.deviceType?.category !== "ev_charger") return { ok: false, status: 404, error: "EV reports are available for EV chargers." };

  const supabase = await createClient();
  const span = spanOfDays(from, to);
  const [tariff, { data }] = await Promise.all([
    fetchResolvedTariff(supabase, site, plan?.tariffRatePerKwh ?? 8),
    supabase
      .from("ev_sessions")
      .select(EV_PERF_COLUMNS)
      .eq("equipment_id", device.id)
      .gte("started_at", new Date(span.fromMs).toISOString())
      .lt("started_at", new Date(span.toMs).toISOString())
      .order("started_at", { ascending: false })
      .limit(MAX_SESSIONS),
  ]);
  const where = tariff.state ? `${tariff.state} ${CATEGORY_LABEL[tariff.category]}` : CATEGORY_LABEL[tariff.category];
  return {
    ok: true,
    report: buildEvReport({
      customerName: profile.full_name ?? "Customer",
      siteName: site?.name ?? null,
      deviceLabel: deviceDisplayId(device),
      generatedAt: new Date().toISOString(),
      from,
      to,
      tariffRate: tariff.rate > 0 ? tariff.rate : null,
      tariffNote: `${where} tariff${tariff.effectiveFrom ? `, in force since ${fmtDate(tariff.effectiveFrom)}` : ""}`,
      sessions: (data ?? []) as unknown as EvPerfSession[],
    }),
  };
}
