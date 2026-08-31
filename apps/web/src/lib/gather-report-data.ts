import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { maxByDeviceDay, sumByDay, type DailyPoint } from "@/lib/energy-aggregation";

const YIELD_INSTRUMENT_KEY = "daily_yield_kwh";
const COMPARISON_WINDOW_DAYS = 30;

export interface ReportData {
  authorized: boolean;
  customerName: string;
  planName: string;
  tariffRate: number;
  daily: DailyPoint[];
  totalKwh: number;
  totalSaved: number;
  totalInvested: number;
  roiPct: number | null;
  sites: { name: string; kwhLast30Days: number }[];
}

/**
 * Shared by the Reports page, the CSV export route, and the PDF export
 * route — all three need the same RLS-scoped dataset, and duplicating this
 * query/aggregation three times is how they'd eventually disagree.
 * `historyDays` controls how far back readings are pulled (the CSV/PDF
 * period selector).
 */
export async function gatherReportData(historyDays: number): Promise<ReportData> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  if (!profile) {
    return {
      authorized: false,
      customerName: "",
      planName: "",
      tariffRate: 0,
      daily: [],
      totalKwh: 0,
      totalSaved: 0,
      totalInvested: 0,
      roiPct: null,
      sites: [],
    };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("tariff_rate_per_kwh, plan:plans(name, features)")
    .eq("id", profile.id)
    .maybeSingle();

  const features = (customer?.plan?.features as Record<string, boolean>) ?? {};
  if (!features.reports) {
    return {
      authorized: false,
      customerName: profile.full_name ?? "",
      planName: customer?.plan?.name ?? "",
      tariffRate: 0,
      daily: [],
      totalKwh: 0,
      totalSaved: 0,
      totalInvested: 0,
      roiPct: null,
      sites: [],
    };
  }

  const tariffRate = Number(customer?.tariff_rate_per_kwh ?? 8);

  const { data: sites } = await supabase.from("sites").select("id, name").order("created_at", { ascending: true });
  const { data: devices } = await supabase.from("devices").select("id, site_id");
  const deviceIds = (devices ?? []).map((d) => d.id);
  const siteIdByDevice = new Map((devices ?? []).map((d) => [d.id, d.site_id]));

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - historyDays);

  let readings: { device_id: string; value: number | null; ts: string }[] = [];
  if (deviceIds.length > 0) {
    const { data } = await supabase
      .from("device_readings")
      .select("device_id, value, ts")
      .in("device_id", deviceIds)
      .eq("instrument_key", YIELD_INSTRUMENT_KEY)
      .eq("is_test", false)
      .gte("ts", since.toISOString())
      .order("ts", { ascending: true });
    readings = data ?? [];
  }

  const { data: payments } = await supabase.from("payments").select("amount, status").eq("status", "paid");
  const totalInvested = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const perDeviceDay = maxByDeviceDay(readings);
  const daily = sumByDay(perDeviceDay);
  const totalKwh = daily.reduce((sum, p) => sum + p.value, 0);
  const totalSaved = totalKwh * tariffRate;
  const roiPct = totalInvested > 0 ? (totalSaved / totalInvested) * 100 : null;

  const comparisonSince = new Date();
  comparisonSince.setUTCDate(comparisonSince.getUTCDate() - COMPARISON_WINDOW_DAYS);
  const comparisonSinceStr = comparisonSince.toISOString().slice(0, 10);
  const siteTotals = new Map<string, number>();
  for (const [key, value] of perDeviceDay) {
    const [deviceId, day] = key.split(":");
    if (day < comparisonSinceStr) continue;
    const siteId = siteIdByDevice.get(deviceId);
    if (!siteId) continue;
    siteTotals.set(siteId, (siteTotals.get(siteId) ?? 0) + value);
  }
  const siteRows = (sites ?? []).map((s) => ({
    name: s.name,
    kwhLast30Days: siteTotals.get(s.id) ?? 0,
  }));

  return {
    authorized: true,
    customerName: profile.full_name ?? "Customer",
    planName: customer?.plan?.name ?? "—",
    tariffRate,
    daily,
    totalKwh,
    totalSaved,
    totalInvested,
    roiPct,
    sites: siteRows,
  };
}

/** Buckets a daily series into ISO-week (Monday-anchored) sums, most recent
 *  first, capped to `maxWeeks` rows for a report table. */
export function toWeeklyRows(daily: DailyPoint[], maxWeeks = 12): { label: string; kwh: number }[] {
  const buckets = new Map<string, number>();
  for (const point of daily) {
    const date = new Date(point.date + "T00:00:00Z");
    const day = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setUTCDate(monday.getUTCDate() - day);
    const key = monday.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + point.value);
  }
  const rows = Array.from(buckets.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, maxWeeks)
    .map(([mondayStr, kwh]) => {
      const monday = new Date(mondayStr + "T00:00:00Z");
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return { label: `${fmt(monday)} – ${fmt(sunday)}`, kwh };
    });
  return rows;
}
